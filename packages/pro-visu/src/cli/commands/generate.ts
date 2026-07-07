import { resolveCwd, resolveOutDir } from "@/utils/paths";
import { ensureDir } from "@/utils/fs";
import { createLogger, createReportingLogger, type Logger } from "@/utils/logger";
import { loadShowcaseConfig } from "@/config/load";
import type { ResolvedConfig } from "@/config/schema";
import { resolveTargets } from "@/config/resolve-targets";
import { getGenerator } from "@/generators/registry";
import { watchForInterrupt } from "@/cli/interrupt";
import { reexecWithMemory, autoHeapTargetMB, currentHeapLimitMB } from "@/cli/reexec";
import os from "node:os";
import path from "node:path";
import v8 from "node:v8";
import { startRunState, updateRunState, clearRunState, cleanStaleRunState } from "@/cli/run-state";
import { refreshSchemaFile } from "@/config/json-schema";
import { ensureChromium } from "@/binaries/chromium";
import { ensureFfmpeg } from "@/binaries/ensure-ffmpeg";
import {
  startManagedServer,
  resolveServerUrl,
  type ServerHandle,
  type ServerTasks,
  type TaskHandle,
} from "@/server/manage-server";
import {
  runPipeline,
  applyDerivedInputs,
  applyQuality,
  mergeGeneratorOptions,
  type AssetOutcome,
} from "@/pipeline/runner";
import { expandSelection, dependenciesOf } from "@/pipeline/graph";
import { createReporter } from "@/cli/dashboard";
import type { Reporter } from "@/pipeline/reporter";
import { TOOL_VERSION } from "@/version";
import { reportConfigError, printSummary } from "@/cli/ui";
import { generatorIds } from "@/generators/registry";
import { legacyGeneratorHint, legacyOptionHint } from "@/generators/migration";
import { didYouMean } from "@/utils/suggest";

export interface GenerateOptions {
  cwd?: string;
  config?: string;
  asset?: string | string[];
  concurrency?: string | number;
  skipBrowser?: boolean;
  /** Skip the managed server (use an already-running site at the asset URLs). */
  skipServer?: boolean;
  /** Keep the managed server but skip its build step (fast iteration when the site is unchanged). */
  skipBuild?: boolean;
  /** Draft quality: faster, lower-fidelity renders for iteration. */
  draft?: boolean;
  /** Skip assets whose inputs+options+tool fingerprint is unchanged. */
  cache?: boolean;
  verbose?: boolean;
}

export async function runGenerate(options: GenerateOptions = {}): Promise<void> {
  const cwd = resolveCwd(options.cwd);
  const bootstrapLog: Logger = createLogger(options.verbose ? "debug" : "info");

  let loaded;
  try {
    loaded = await loadShowcaseConfig({ cwd, configFile: options.config });
  } catch (err) {
    reportConfigError(bootstrapLog, err);
    process.exitCode = 1;
    return;
  }
  const { config } = loaded;

  // Keep a scaffolded pro-visu.schema.json current with this tool version (JSON-config editor
  // autocomplete). Best-effort; looks next to the config file.
  await refreshSchemaFile(loaded.configFile ? path.dirname(loaded.configFile) : cwd, bootstrapLog);

  // NOTE: everything up to the dashboard mounting logs through `bootstrapLog` — the reporting
  // logger buffers lines into the not-yet-rendered dashboard, which would swallow early errors.
  const outDir = resolveOutDir(cwd, config.settings.outDir);

  // Reject a malformed --concurrency loudly instead of silently falling back to the config value.
  // (A bare `--concurrency` with no value reaches us as boolean true — also malformed.)
  let concurrencyOverride: number | undefined;
  if (options.concurrency != null) {
    const raw: unknown = options.concurrency;
    const n = typeof raw === "boolean" ? Number.NaN : Number(raw);
    if (!Number.isInteger(n) || n < 1) {
      bootstrapLog.error(`Invalid --concurrency "${options.concurrency}" — expected a positive integer.`);
      process.exitCode = 1;
      return;
    }
    concurrencyOverride = n;
  }

  const requested = normalizeAssetNames(options.asset);
  if (requested) {
    const known = new Set(config.assets.map((a) => a.name));
    const unknown = requested.filter((name) => !known.has(name));
    for (const name of unknown) bootstrapLog.warn(`Unknown asset "${name}"${didYouMean(name, known)}`);
    if (requested.every((name) => !known.has(name))) {
      bootstrapLog.error("No matching assets to generate.");
      process.exitCode = 1;
      return;
    }
  }

  // Resolve the full plan before any heavy work (browser install, ffmpeg fetch, site build):
  // selection, per-asset option validation, and the managed-server decision. Config mistakes fail
  // here in seconds — not after a minutes-long setup. Derive option-declared dependencies first
  // (e.g. a wall's tile producers) so the selection sees them.
  applyDerivedInputs(config);
  const selected = expandSelection(config.assets, requested);
  const quality = options.draft ? "draft" : config.settings.quality;
  if (!validatePlan(bootstrapLog, config, selected, quality)) {
    process.exitCode = 1;
    return;
  }

  // Heavy frame-stepped plans (real walls) can exceed Node's default heap: pick a bigger target
  // from the machine's RAM and re-exec with --max-old-space-size before any heavy work. The child
  // runs the whole command; nothing to do here afterwards.
  const heapTarget = autoHeapTargetMB(selected);
  if (await reexecWithMemory(heapTarget)) return;
  if (heapTarget) {
    bootstrapLog.debug(`Node heap limit: ${currentHeapLimitMB()} MB (auto target ${heapTarget} MB)`);
  }

  // The managed server only matters to url-based generators (it captures web pages). If nothing in
  // the selection needs a URL — e.g. only a `test`-mode wall, or other local generators — skip it
  // automatically so previews don't pay for a site build/boot they never use.
  const anyNeedsServer = selected.some((s) => Boolean(getGenerator(s.generator)?.requiresUrl));
  if (config.settings.server && !options.skipServer && !anyNeedsServer) {
    bootstrapLog.info("No selected asset needs a URL — skipping the managed server.");
  }
  const baseServerCfg = options.skipServer || !anyNeedsServer ? undefined : config.settings.server;
  // --skip-build keeps the managed server but drops its one-shot build (the site is unchanged).
  const serverCfg =
    baseServerCfg && options.skipBuild ? { ...baseServerCfg, build: undefined } : baseServerCfg;

  // The managed server's URL is the default base: a url-based asset that omits `url` captures its
  // root, and a relative `url` resolves against it. (No server → assets as authored.)
  const serverBase = serverCfg ? resolveServerUrl(serverCfg) : undefined;
  const resolvedConfig: ResolvedConfig = {
    ...config,
    assets: resolveTargets(config.assets, serverBase, (id) =>
      Boolean(getGenerator(id)?.requiresUrl),
    ),
  };

  // No managed server → the asset URLs must already be live. Probe them now so a dead dev server
  // fails with one actionable message instead of a per-asset Playwright navigation error later.
  if (!serverCfg && !(await preflightUrls(bootstrapLog, resolvedConfig, selected))) {
    process.exitCode = 1;
    return;
  }

  // Ensure a managed Chromium unless a system channel/executable is configured, or skipped.
  const usingManaged =
    !config.settings.browser.channel && !config.settings.browser.executablePath;
  if (!options.skipBrowser && usingManaged) {
    const ready = await ensureChromium({ logger: bootstrapLog });
    if (!ready) {
      bootstrapLog.error("Chromium is required. Run `pro-visu init` or install it manually.");
      process.exitCode = 1;
      return;
    }
  }

  // Self-heal ffmpeg: the video generators shell out to it, and the managed binary may be
  // missing/corrupt when a previous fetch was interrupted.
  if (!(await ensureFfmpeg({ logger: bootstrapLog }))) {
    bootstrapLog.error("A working ffmpeg is required for video generators.");
    process.exitCode = 1;
    return;
  }

  const level = options.verbose ? "debug" : config.settings.logLevel;
  // Live job tracker on an interactive TTY; per-asset logs feed each row's current step.
  const reporter = createReporter({ tty: Boolean(process.stdout.isTTY), verbose: !!options.verbose });
  const logger = reporter.isLive ? createReportingLogger(level, reporter) : createLogger(level);

  // Self-heal: if a previous run was killed hard, tear down its orphaned server/temp dirs now.
  // Then track THIS run on disk so the next startup can do the same for us, and let Esc /
  // Ctrl+C stop it gracefully (a second press bails immediately).
  await ensureDir(outDir);
  await cleanStaleRunState(outDir, bootstrapLog);
  await startRunState(outDir);
  const abort = new AbortController();
  let interrupted = false;
  let lowMemory = false;
  // The live dashboard owns the keyboard (Ink raw mode), so the watcher only handles signals there
  // and the dashboard calls `trigger` on Esc/Ctrl+C — one keypress owner, no clash.
  const { dispose: disposeInterrupt, trigger: interruptTrigger } = watchForInterrupt(
    () => {
      interrupted = true;
      abort.abort(); // graceful: stop launching new work, let in-flight finish, then tear down
      // Acknowledge the keypress immediately: the live tracker flips to a "cancelling…" banner;
      // without it (non-TTY/--verbose) print a line, since in-flight renders can take seconds.
      if (reporter.isLive) reporter.cancelling();
      else logger.warn("Cancelling — finishing in-flight work… (press again to force-quit)");
    },
    () => {
      try {
        process.stdin.setRawMode?.(false); // restore the terminal before bailing
        process.stdout.write("\x1b[?25h"); // and the cursor (force-quit skips Ink's own cleanup)
      } catch {
        /* ignore */
      }
      process.exit(130);
    },
    { keyboard: !reporter.isLive },
  );
  // Hand the cancel trigger to the live dashboard so its useInput handler drives the same flow.
  if (reporter.isLive) reporter.attachInput?.(interruptTrigger);

  // From here the live tracker owns the terminal. Plan ALL rows up front — setup (build/server)
  // then every asset, with the assets gated on setup so they read "waiting for build" until it
  // finishes. The build no longer dumps raw CLI output; it feeds the "build" row's step. The
  // tracker's footer shows the "esc to cancel" hint.
  reporter.begin();

  // Memory watchdog, two triggers, each stopping the run gracefully (like Esc) with a clear message:
  //  1. The Node heap nearing its V8 limit — instead of a hard "JavaScript heap out of memory" crash.
  //     (Heavy wall plans already re-exec with a bigger heap; this catches everything else.)
  //  2. SYSTEM memory nearly exhausted — the heavy usage lives in Chromium renderers and ffmpeg
  //     encoders, which the Node heap number cannot see; when the OS runs out, the machine swap-
  //     thrashes or the browser is OOM-killed mid-capture. Sampled via os.freemem(), and tripped only
  //     on two consecutive low samples so a transient dip can't cancel a healthy run.
  const SYSTEM_FREE_FLOOR_BYTES = 512 * 1024 * 1024;
  let lowFreeSamples = 0;
  const stopForMemory = (plainMessage: string): void => {
    lowMemory = true;
    interrupted = true;
    abort.abort();
    if (reporter.isLive) reporter.cancelling("low memory — stopping…");
    else logger.warn(plainMessage);
  };
  const memTimer = setInterval(() => {
    if (interrupted) return;
    const limit = v8.getHeapStatistics().heap_size_limit;
    const used = process.memoryUsage().heapUsed;
    if (limit > 0 && used / limit > 0.88) {
      stopForMemory(
        "Low memory — stopping early to avoid a crash (lower settings.concurrency or the asset's workers).",
      );
      return;
    }
    lowFreeSamples = os.freemem() < SYSTEM_FREE_FLOOR_BYTES ? lowFreeSamples + 1 : 0;
    if (lowFreeSamples >= 2) {
      stopForMemory(
        "System memory nearly exhausted — stopping early to avoid a crash (lower settings.concurrency or the asset's workers).",
      );
    }
  }, 1500);
  memTimer.unref?.();

  const gates: string[] = [];
  const tasks: ServerTasks = {};
  if (reporter.isLive && serverCfg) {
    if (serverCfg.build) {
      reporter.add({ id: "@build", name: "build", detail: "server", system: true });
      gates.push("@build");
      tasks.build = taskHandle(reporter, "@build");
    }
    reporter.add({ id: "@server", name: "server", detail: "server", system: true });
    gates.push("@server");
    tasks.server = taskHandle(reporter, "@server");
  }
  if (reporter.isLive) {
    for (const spec of selected) {
      reporter.add({
        id: spec.name,
        name: spec.name,
        detail: spec.generator,
        deps: dependenciesOf(spec),
        gatedBy: gates,
      });
    }
  }

  let server: ServerHandle | null = null;
  let outcomes: AssetOutcome[] = [];
  let setupFailed = false;
  try {
    if (serverCfg) {
      server = await startManagedServer(serverCfg, cwd, logger, tasks, abort.signal);
      await updateRunState(outDir, { serverPid: server?.pid });
    }

    if (!reporter.isLive) logger.start(`Generating ${selected.length} asset(s)…`);

    outcomes = await runPipeline({
      config: resolvedConfig,
      outDir,
      logger,
      toolVersion: TOOL_VERSION,
      assetNames: requested,
      concurrency: concurrencyOverride,
      quality: options.draft ? "draft" : undefined,
      cache: options.cache,
      reporter,
      signal: abort.signal,
      onResources: (r) => void updateRunState(outDir, { tmpDirs: [r.tmpDir] }),
    });
  } catch (err) {
    reporter.stop();
    if (!interrupted) {
      logger.error((err as Error).message);
      process.exitCode = 1;
      setupFailed = true;
    }
  } finally {
    clearInterval(memTimer);
    reporter.stop(); // erase the live block before the final summary
    disposeInterrupt();
    await server?.stop();
    await clearRunState(outDir);
  }

  if (interrupted) {
    // A graceful stop is a clean exit, not a failure — exit 0 so the shell/pnpm doesn't print a
    // scary "command failed" wrapper. In-flight assets are aborted mid-work, so only the ones that
    // actually completed are "finished".
    const finished = outcomes.filter((o) => o.status === "ok").length;
    if (lowMemory) {
      logger.warn(
        `Stopped early — low memory (${finished} asset(s) finished). Lower settings.concurrency ` +
          `or the asset's workers, then re-run (already-finished assets are cached if --cache is on).`,
      );
    } else {
      logger.warn(`Interrupted — stopped cleanly (${finished} asset(s) finished).`);
    }
    process.exitCode = 0;
    return;
  }
  if (setupFailed) return; // error already reported; no summary to show

  printSummary(logger, outcomes, outDir);
  if (outcomes.some((outcome) => outcome.status === "failed")) {
    process.exitCode = 1;
  }
}

/**
 * Validate the run plan up front: every selected asset's generator must exist and its merged
 * options must parse. Also flags `settings.defaults` keys that match no generator (they would
 * silently never apply). Returns false — with everything wrong reported — when the plan is bad.
 */
export function validatePlan(
  log: Logger,
  config: ResolvedConfig,
  selected: ResolvedConfig["assets"],
  quality: "draft" | "final",
): boolean {
  let ok = true;
  const ids = generatorIds();
  const known = new Set(ids);
  for (const key of Object.keys(config.settings.defaults)) {
    if (!known.has(key)) {
      log.warn(`settings.defaults["${key}"] matches no generator${didYouMean(key, ids)} — it will never apply.`);
    }
  }
  for (const spec of selected) {
    const generator = getGenerator(spec.generator);
    if (!generator) {
      const legacy = legacyGeneratorHint(spec.generator);
      log.error(
        `Asset "${spec.name}": unknown generator "${spec.generator}"${didYouMean(spec.generator, ids)}. ` +
          (legacy ? `${legacy}. ` : "") +
          `Available: ${ids.join(", ")}.`,
      );
      ok = false;
      continue;
    }
    const merged = applyQuality(mergeGeneratorOptions(config.settings.defaults, spec), quality);
    const parsed = generator.optionsSchema.safeParse(merged);
    if (!parsed.success) {
      log.error(`Asset "${spec.name}" has invalid ${spec.generator} options:`);
      for (const issue of parsed.error.issues) {
        const where = ["options", ...issue.path].join(".");
        const hint = legacyOptionHint(spec.generator, issue);
        log.error(`  • ${where}: ${issue.message}${hint ? ` — ${hint}` : ""}`);
      }
      ok = false;
    }
  }
  return ok;
}

/**
 * With no managed server, every url-based asset must point at something already live. Verify that
 * up front — one probe per origin — so a dead dev server fails with a single actionable message
 * instead of a per-asset Playwright navigation error minutes later.
 */
export async function preflightUrls(
  log: Logger,
  resolvedConfig: ResolvedConfig,
  selected: ResolvedConfig["assets"],
): Promise<boolean> {
  const byName = new Map(resolvedConfig.assets.map((a) => [a.name, a]));
  const missing: string[] = [];
  const relative: string[] = [];
  const urls = new Set<string>();
  for (const s of selected) {
    if (!getGenerator(s.generator)?.requiresUrl) continue;
    const url = byName.get(s.name)?.url;
    if (!url) missing.push(s.name);
    else if (url.startsWith("/")) relative.push(`"${s.name}" (${url})`);
    else urls.add(url);
  }

  let ok = true;
  if (missing.length) {
    log.error(
      `Asset(s) missing a url: ${missing.join(", ")} — set "url", or configure settings.server ` +
        `so they capture the managed server's root.`,
    );
    ok = false;
  }
  if (relative.length) {
    log.error(
      `Relative url(s) require the managed server: ${relative.join(", ")} — configure ` +
        `settings.server, or use absolute URLs.`,
    );
    ok = false;
  }

  // One probe per origin. Any HTTP response — even a 4xx/5xx — proves something is listening;
  // only connection-level failures (refused, DNS, timeout) count as unreachable.
  const origins = new Map<string, string>();
  for (const url of urls) {
    try {
      const origin = new URL(url).origin;
      if (!origins.has(origin)) origins.set(origin, url);
    } catch {
      /* shape already vetted by the config schema */
    }
  }
  const probes = await Promise.all(
    [...origins.values()].map(async (url) => ((await urlResponds(url)) ? null : url)),
  );
  const unreachable = probes.filter((url): url is string => url !== null);
  if (unreachable.length) {
    for (const url of unreachable) log.error(`Nothing is responding at ${url}.`);
    log.error(
      "Start your site (or point the asset urls at a deployed one), or configure settings.server " +
        "so pro-visu builds and starts it for you.",
    );
    ok = false;
  }
  return ok;
}

/** Does anything answer HTTP at this URL? (Any status counts; only connection failures don't.) */
async function urlResponds(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    await fetch(url, { signal: ctrl.signal, redirect: "manual" });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** A live-tracker row handle the managed-server lifecycle drives (build/server steps). */
function taskHandle(reporter: Reporter, id: string): TaskHandle {
  return {
    start: () => reporter.status(id, "running"),
    step: (t) => reporter.step(id, t),
    ok: () => reporter.status(id, "ok"),
    fail: () => reporter.status(id, "failed"),
  };
}

function normalizeAssetNames(value?: string | string[]): string[] | undefined {
  if (value == null) return undefined;
  const arr = (Array.isArray(value) ? value : [value]).map(String).filter(Boolean);
  return arr.length ? arr : undefined;
}
