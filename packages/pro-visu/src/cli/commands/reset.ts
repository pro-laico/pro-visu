import path from "node:path";
import { resolveCwd, resolveOutDir } from "@/utils/paths";
import { createLogger } from "@/utils/logger";
import { loadShowcaseConfig } from "@/config/load";
import { DEFAULT_OUTDIR } from "@/config/defaults";
import { removeDir } from "@/utils/fs";
import { readRunState, clearRunState, isAlive, killTreeByPid } from "@/cli/run-state";

export interface ResetOptions {
  cwd?: string;
  config?: string;
  /** Clean up even if a run still looks active. */
  force?: boolean;
}

/**
 * Tear down whatever a previous `generate` left running when it was killed hard (Ctrl+C/crash):
 * the managed server and browser process trees, plus its temp working dirs, recorded in the
 * run-state file. A clean exit removes that file, so there's normally nothing to do.
 */
export async function runReset(options: ResetOptions = {}): Promise<void> {
  const cwd = resolveCwd(options.cwd);
  const log = createLogger("info");

  // The run-state file lives under the output dir; fall back to the default if config can't load.
  let outDir = path.join(cwd, DEFAULT_OUTDIR);
  try {
    const { config } = await loadShowcaseConfig({ cwd, configFile: options.config });
    outDir = resolveOutDir(cwd, config.settings.outDir);
  } catch {
    /* no/invalid config — still try the default output dir */
  }

  const state = await readRunState(outDir);
  if (!state) {
    log.success("Nothing to reset — no interrupted run recorded.");
    return;
  }
  if (isAlive(state.pid) && !options.force) {
    log.warn(
      `A run looks active (pid ${state.pid}). If it's stuck, re-run with --force to clean up anyway.`,
    );
    return;
  }

  let killed = 0;
  if (await killTreeByPid(state.serverPid)) {
    killed += 1;
    log.info(`Stopped orphaned server (pid ${state.serverPid}).`);
  }
  let removed = 0;
  for (const dir of state.tmpDirs ?? []) {
    await removeDir(dir);
    removed += 1;
  }
  await clearRunState(outDir);

  log.success(
    `Reset complete — stopped ${killed} process tree(s), removed ${removed} temp dir(s).`,
  );
}
