import { resolveCwd, resolveOutDir } from "@/utils/paths";
import { ensureDir } from "@/utils/fs";
import { createLogger, createReportingLogger, type Logger } from "@/utils/logger";
import { loadShowcaseConfig } from "@/config/load";
import type { ResolvedConfig } from "@/config/schema";
import { resolveTargets } from "@/config/resolve-targets";
import { getGenerator } from "@/generators/registry";
import { watchForInterrupt } from "@/cli/interrupt";
import { reexecWithMemory, currentHeapLimitMB } from "@/cli/reexec";
import v8 from "node:v8";
import { startRunState, updateRunState, clearRunState } from "@/cli/run-state";
import { ensureChromium } from "@/browser-install/ensure-chromium";
import { ensureFfmpeg } from "@/media/ensure-ffmpeg";
import {
  startManagedServer,
  resolveServerUrl,
  type ServerHandle,
  type ServerTasks,
  type TaskHandle,
} from "@/server/manage-server";
import { runPipeline, applyDerivedInputs, type AssetOutcome } from "@/pipeline/runner";
import { expandSelection, dependenciesOf } from "@/pipeline/graph";
import { createReporter } from "@/cli/dashboard";
import type { Reporter } from "@/pipeline/reporter";
import { TOOL_VERSION } from "@/version";
import { reportConfigError, printSummary } from "@/cli/ui";

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

  // Honor settings.maxMemoryMB: if it wants more heap than this process has, re-exec with a larger
  // --max-old-space-size and let the child run the whole command. Must happen before any heavy work.
  if (await reexecWithMemory(config.settings.maxMemoryMB)) return;
  if (config.settings.maxMemoryMB) {
    bootstrapLog.info(`Node heap limit: ${currentHeapLimitMB()} MB (settings.maxMemoryMB=${config.settings.maxMemoryMB})`);
  }

  const level = options.verbose ? "debug" : config.settings.logLevel;
  // Live job tracker on an interactive TTY; per-asset logs feed each row's current step.
  const reporter = createReporter({ tty: Boolean(process.stdout.isTTY), verbose: !!options.verbose });
  const logger = reporter.isLive ? createReportingLogger(level, reporter) : createLogger(level);
  const outDir = resolveOutDir(cwd, config.settings.outDir);

  const requested = normalizeAssetNames(options.asset);
  if (requested) {
    const known = new Set(config.assets.map((a) => a.name));
    const unknown = requested.filter((name) => !known.has(name));
    if (unknown.length) logger.warn(`Unknown asset(s): ${unknown.join(", ")}`);
    if (requested.every((name) => !known.has(name))) {
      logger.error("No matching assets to generate.");
      process.exitCode = 1;
      return;
    }
  }

  // Ensure a managed Chromium unless a system channel/executable is configured, or skipped.
  const usingManaged =
    !config.settings.browser.channel && !config.settings.browser.executablePath;
  if (!options.skipBrowser && usingManaged) {
    const ready = await ensureChromium({ logger });
    if (!ready) {
      logger.error("Chromium is required. Run `showcase init` or install it manually.");
      process.exitCode = 1;
      return;
    }
  }

  // Self-heal ffmpeg: the video generators shell out to it, and the bundled binary may be
  // missing/corrupt when the consumer's package manager skipped build scripts.
  if (!(await ensureFfmpeg({ logger }))) {
    logger.error("A working ffmpeg is required for video generators.");
    process.exitCode = 1;
    return;
  }

  // Track this run on disk so `showcase reset` can clean up if it's killed hard, and let Esc /
  // Ctrl+C stop it gracefully (a second press bails immediately; reset mops up any orphans).
  await ensureDir(outDir);
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

  // Memory watchdog: if the Node heap nears its limit, stop the run gracefully (like Esc) with a clear
  // message instead of letting V8 hard-crash ("JavaScript heap out of memory"). Fires once; raise
  // settings.maxMemoryMB (more heap) or lower settings.concurrency to avoid it.
  const memTimer = setInterval(() => {
    if (interrupted) return;
    const limit = v8.getHeapStatistics().heap_size_limit;
    const used = process.memoryUsage().heapUsed;
    if (limit > 0 && used / limit > 0.88) {
      lowMemory = true;
      interrupted = true;
      abort.abort();
      if (reporter.isLive) reporter.cancelling("low memory — stopping…");
      else
        logger.warn(
          "Low memory — stopping early to avoid a crash (raise settings.maxMemoryMB or lower concurrency).",
        );
    }
  }, 1500);
  memTimer.unref?.();

  // The managed server only matters to url-based generators (it captures web pages). If nothing in
  // the selection needs a URL — e.g. only a `test`-mode wall, or other local generators — skip it
  // automatically so previews don't pay for a site build/boot they never use. Derive option-declared
  // dependencies first (e.g. a real wall's tile producers) so the selection — and this check — see
  // them; a `test`-mode wall declares none, so it collapses to just itself.
  applyDerivedInputs(config);
  const selected = expandSelection(config.assets, requested);
  const anyNeedsServer = selected.some((s) => Boolean(getGenerator(s.generator)?.requiresUrl));
  if (config.settings.server && !options.skipServer && !anyNeedsServer) {
    logger.info("No selected asset needs a URL — skipping the managed server.");
  }

  const baseServerCfg = options.skipServer || !anyNeedsServer ? undefined : config.settings.server;
  // --skip-build keeps the managed server but drops its one-shot build (the site is unchanged).
  const serverCfg =
    baseServerCfg && options.skipBuild ? { ...baseServerCfg, build: undefined } : baseServerCfg;

  // The managed server's URL is the default base: a url-based asset that omits `url` captures its
  // root, and relative `url`/`routes` entries resolve against it. (No server → assets as authored.)
  const serverBase = serverCfg ? resolveServerUrl(serverCfg) : undefined;
  const resolvedConfig: ResolvedConfig = {
    ...config,
    assets: resolveTargets(config.assets, serverBase, (id) =>
      Boolean(getGenerator(id)?.requiresUrl),
    ),
  };

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

    const concurrency =
      options.concurrency != null ? Number(options.concurrency) : undefined;
    const count = requested ? requested.length : config.assets.length;
    if (!reporter.isLive) logger.start(`Generating ${count} asset(s)…`);

    outcomes = await runPipeline({
      config: resolvedConfig,
      outDir,
      logger,
      toolVersion: TOOL_VERSION,
      assetNames: requested,
      concurrency: Number.isFinite(concurrency) ? concurrency : undefined,
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
        `Stopped early — low memory (${finished} asset(s) finished). Raise settings.maxMemoryMB or ` +
          `lower settings.concurrency, then re-run (already-finished assets are cached if --cache is on).`,
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
