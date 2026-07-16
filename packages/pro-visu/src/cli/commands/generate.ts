import os from "node:os";
import v8 from "node:v8";
import path from "node:path";

import { ensureDir } from "@/utils/fs";
import { TOOL_VERSION } from "@/version";
import { didYouMean } from "@/utils/suggest";
import { createReporter } from "@/cli/dashboard";
import { loadShowcaseConfig } from "@/config/load";
import type { Reporter } from "@/pipeline/reporter";
import { getGenerator } from "@/generators/registry";
import { watchForInterrupt } from "@/cli/interrupt";
import { ensureChromium } from "@/binaries/chromium";
import { generatorIds } from "@/generators/registry";
import type { ResolvedConfig } from "@/config/schema";
import { ensureFfmpeg } from "@/binaries/ensure-ffmpeg";
import { refreshSchemaFile } from "@/config/json-schema";
import { resolveTargets } from "@/config/resolve-targets";
import { reportConfigError, printSummary } from "@/cli/ui";
import { resolveSelection, dependenciesOf } from "@/pipeline/graph";
import { resolveCwd, resolveConfigDir, resolveOutDir } from "@/utils/paths";
import { legacyGeneratorHint, legacyOptionHint } from "@/generators/migration";
import { createLogger, createReportingLogger, type Logger } from "@/utils/logger";
import { reexecWithMemory, autoHeapTargetMB, currentHeapLimitMB } from "@/cli/reexec";
import { startRunState, updateRunState, clearRunState, cleanStaleRunState } from "@/cli/run-state";
import { runPipeline, applyDerivedInputs, applyQuality, mergeGeneratorOptions, type AssetOutcome } from "@/pipeline/runner";
import { startManagedServer, resolveServerUrl, type ServerHandle, type ServerTasks, type TaskHandle } from "@/server/manage-server";

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
  const configDir = resolveConfigDir(cwd, loaded.configFile);

  await refreshSchemaFile(configDir, bootstrapLog);

  const outDir = resolveOutDir(configDir, config.settings.outDir);

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

  applyDerivedInputs(config);
  const selected = resolveSelection(config.assets, requested, config.settings.enabled);
  if (selected.length === 0) {
    if (!requested) {
      const { enabled } = config.settings;
      const why =
        enabled === false
          ? "settings.enabled is false"
          : typeof enabled === "string"
            ? `no assets are tagged enabled: "${enabled}" (settings.enabled)`
            : "no assets are enabled";
      bootstrapLog.error(`No assets to generate — ${why}.`);
    } else {
      bootstrapLog.error("No matching assets to generate.");
    }
    process.exitCode = 1;
    return;
  }
  const quality = options.draft ? "draft" : "final";
  if (!validatePlan(bootstrapLog, config, selected, quality)) {
    process.exitCode = 1;
    return;
  }

  const heapTarget = autoHeapTargetMB(selected);
  if (await reexecWithMemory(heapTarget)) return;
  if (heapTarget) bootstrapLog.debug(`Node heap limit: ${currentHeapLimitMB()} MB (auto target ${heapTarget} MB)`);

  const anyNeedsServer = selected.some((s) => Boolean(getGenerator(s.generator)?.requiresUrl));
  if (config.settings.server && !options.skipServer && !anyNeedsServer) {
    bootstrapLog.info("No selected asset needs a URL — skipping the managed server.");
  }
  const baseServerCfg = options.skipServer || !anyNeedsServer ? undefined : config.settings.server;
  const serverCfg = baseServerCfg && options.skipBuild ? { ...baseServerCfg, build: false as const } : baseServerCfg;

  const serverBase = serverCfg ? resolveServerUrl(serverCfg) : undefined;
  const resolvedConfig: ResolvedConfig = {
    ...config,
    assets: resolveTargets(config.assets, serverBase, (id) => Boolean(getGenerator(id)?.requiresUrl)),
  };

  if (!serverCfg && !(await preflightUrls(bootstrapLog, resolvedConfig, selected))) {
    process.exitCode = 1;
    return;
  }

  const usingManaged = !config.settings.browser.channel && !config.settings.browser.executablePath;
  if (!options.skipBrowser && usingManaged) {
    const ready = await ensureChromium({ logger: bootstrapLog });
    if (!ready) {
      bootstrapLog.error("Chromium is required. Run `pro-visu init` or install it manually.");
      process.exitCode = 1;
      return;
    }
  }

  if (!(await ensureFfmpeg({ logger: bootstrapLog }))) {
    bootstrapLog.error("A working ffmpeg is required for video generators.");
    process.exitCode = 1;
    return;
  }

  const level = options.verbose ? "debug" : config.settings.logLevel;
  const reporter = createReporter({ tty: Boolean(process.stdout.isTTY), verbose: !!options.verbose });
  const logger = reporter.isLive ? createReportingLogger(level, reporter) : createLogger(level);

  await ensureDir(outDir);
  await cleanStaleRunState(outDir, bootstrapLog);
  await startRunState(outDir);
  const abort = new AbortController();
  let interrupted = false;
  let lowMemory = false;
  const { dispose: disposeInterrupt, trigger: interruptTrigger } = watchForInterrupt(
    () => {
      interrupted = true;
      abort.abort();
      if (reporter.isLive) reporter.cancelling();
      else logger.warn("Cancelling — finishing in-flight work… (press again to force-quit)");
    },
    () => {
      try {
        process.stdin.setRawMode?.(false);
        process.stdout.write("\x1b[?25h");
      } catch {
        // best-effort: terminal restore (raw mode off, cursor back) can throw on a closed stdio — we're force-quitting via process.exit(130) regardless
      }
      process.exit(130);
    },
    { keyboard: !reporter.isLive },
  );
  if (reporter.isLive) reporter.attachInput?.(interruptTrigger);

  reporter.begin();

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
      stopForMemory("Low memory — stopping early to avoid a crash (lower settings.concurrency or the asset's workers).");
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
    if (serverCfg.build !== false) {
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
      reporter.add({ id: spec.name, name: spec.name, detail: spec.generator, deps: dependenciesOf(spec), gatedBy: gates });
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
      logger.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
      setupFailed = true;
    }
  } finally {
    clearInterval(memTimer);
    reporter.stop();
    disposeInterrupt();
    await server?.stop();
    await clearRunState(outDir);
  }

  if (interrupted) {
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
  if (setupFailed) return;

  printSummary(logger, outcomes, outDir);
  if (outcomes.some((outcome) => outcome.status === "failed")) process.exitCode = 1;
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
    const parsed = generator.optionsSchema.safeParse(merged, { reportInput: true });
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
      `Relative url(s) require the managed server: ${relative.join(", ")} — configure ` + `settings.server, or use absolute URLs.`,
    );
    ok = false;
  }

  const origins = new Map<string, string>();
  for (const url of urls) {
    try {
      const origin = new URL(url).origin;
      if (!origins.has(origin)) origins.set(origin, url);
    } catch {
      // A malformed absolute URL would otherwise skip the probe and fail minutes later at navigation.
      log.error(`Invalid url: ${url}`);
      ok = false;
    }
  }
  const probes = await Promise.all([...origins.values()].map(async (url) => ((await urlResponds(url)) ? null : url)));
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
