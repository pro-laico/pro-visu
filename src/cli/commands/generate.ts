import { resolveCwd, resolveOutDir } from "@/utils/paths";
import { ensureDir } from "@/utils/fs";
import { createLogger, createReportingLogger, type Logger } from "@/utils/logger";
import { loadShowcaseConfig } from "@/config/load";
import { watchForInterrupt } from "@/cli/interrupt";
import { startRunState, updateRunState, clearRunState } from "@/cli/run-state";
import { ensureChromium } from "@/browser-install/ensure-chromium";
import { ensureFfmpeg } from "@/media/ensure-ffmpeg";
import {
  startManagedServer,
  type ServerHandle,
  type ServerTasks,
  type TaskHandle,
} from "@/server/manage-server";
import { runPipeline, type AssetOutcome } from "@/pipeline/runner";
import { expandSelection, dependenciesOf } from "@/pipeline/graph";
import { createReporter } from "@/cli/live-reporter";
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

  // Self-heal ffmpeg: scroll-reel and device-frame both shell out to it, and the bundled
  // binary may be missing/corrupt when the consumer's package manager skipped build scripts.
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
  const disposeInterrupt = watchForInterrupt(
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
      } catch {
        /* ignore */
      }
      process.exit(130);
    },
  );

  // From here the live tracker owns the terminal. Plan ALL rows up front — setup (build/server)
  // then every asset, with the assets gated on setup so they read "waiting for build" until it
  // finishes. The build no longer dumps raw CLI output; it feeds the "build" row's step. The
  // tracker's footer shows the "esc to cancel" hint.
  reporter.begin();

  const serverCfg = options.skipServer ? undefined : config.settings.server;
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
    for (const spec of expandSelection(config.assets, requested)) {
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
      config,
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
    reporter.stop(); // erase the live block before the final summary
    disposeInterrupt();
    await server?.stop();
    await clearRunState(outDir);
  }

  if (interrupted) {
    // A graceful cancel is a clean stop, not a failure — exit 0 so the shell/pnpm doesn't print a
    // scary "command failed with exit code 130" wrapper. (A second Esc force-quits with 130 above.)
    logger.warn(`Interrupted — stopped cleanly (${outcomes.length} asset(s) finished).`);
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
