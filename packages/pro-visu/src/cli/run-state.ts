import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { readFile, writeFile, rm } from "node:fs/promises";

import { removeDir } from "@/utils/fs";

/**
 * A small record of what a `pro-visu generate` run spawned, written to `<outDir>/.pro-visu-run.json`
 * and deleted on a clean exit. If the run is killed hard (Ctrl+C / crash), the file survives and the
 * NEXT `pro-visu generate` tears down the orphaned server + temp dirs automatically on startup.
 */
export interface RunState {
  /** The `pro-visu generate` process id (used to tell "still running" from "orphaned"). */
  pid: number;
  startedAt: string;
  /** Root of the managed server's process tree (the shell we spawned) — the main orphan risk
   *  (Playwright's browser is tied to this process's lifetime and exits on its own). */
  serverPid?: number;
  /** Temp working dirs to remove. */
  tmpDirs?: string[];
}

function runStatePath(outDir: string): string {
  return path.join(outDir, ".pro-visu-run.json");
}

export async function readRunState(outDir: string): Promise<RunState | null> {
  try {
    return JSON.parse(await readFile(runStatePath(outDir), "utf8")) as RunState; //EXCUSE: JSON.parse returns `any`; a malformed file falls through to the catch below
  } catch {
    return null;
  }
}

async function write(outDir: string, state: RunState): Promise<void> {
  try {
    await writeFile(runStatePath(outDir), `${JSON.stringify(state, null, 2)}\n`);
  } catch {}
}

export async function startRunState(outDir: string): Promise<void> {
  await write(outDir, { pid: process.pid, startedAt: new Date().toISOString(), tmpDirs: [] });
}

/** Merge a patch into the on-disk state (tmpDirs are appended, deduped). */
export async function updateRunState(outDir: string, patch: Partial<RunState>): Promise<void> {
  const cur = (await readRunState(outDir)) ?? { pid: process.pid, startedAt: new Date().toISOString() };
  const tmpDirs = [...new Set([...(cur.tmpDirs ?? []), ...(patch.tmpDirs ?? [])])];
  await write(outDir, { ...cur, ...patch, tmpDirs });
}

export async function clearRunState(outDir: string): Promise<void> {
  try {
    await rm(runStatePath(outDir), { force: true });
  } catch {}
}

/**
 * Startup self-healing: if a previous run was killed hard, its run-state file survives — tear down
 * the orphaned server process tree and temp dirs, then clear the file. When the recorded pid is
 * still alive (another run in progress, or a stuck one), leave it and warn. Called by `generate`
 * before starting; a clean previous exit means there's nothing to do.
 */
export async function cleanStaleRunState(outDir: string, log: { info(m: string): void; warn(m: string): void }): Promise<void> {
  const state = await readRunState(outDir);
  if (!state) return;
  if (isAlive(state.pid)) {
    log.warn(`Another pro-visu run looks active (pid ${state.pid}) — not cleaning up after it.`);
    return;
  }
  const killedServer = await killTreeByPid(state.serverPid);
  // The run-state file is on-disk input a repo could ship pre-seeded; only ever delete our own
  // temp dirs (runner.ts creates them all as `<os.tmpdir()>/pro-visu-*`), never arbitrary paths.
  const tmpPrefix = path.join(os.tmpdir(), "pro-visu-");
  for (const dir of state.tmpDirs ?? []) {
    if (path.resolve(dir).startsWith(tmpPrefix)) await removeDir(dir);
    else log.warn(`Skipping suspicious tmp dir in run state (outside ${tmpPrefix}*): ${dir}`);
  }
  await clearRunState(outDir);
  log.info(`Cleaned up after an interrupted run${killedServer ? ` (stopped orphaned server pid ${state.serverPid})` : ""}.`);
}

/** Is a pid still running? */
export function isAlive(pid: number): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM"; //EXCUSE: Node errno errors have no class to instanceof; probing `.code`
  }
}

/** Kill a process and its descendants, cross-platform. Resolves to whether it was alive to kill. */
export function killTreeByPid(pid?: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (!pid || !isAlive(pid)) return resolve(false);
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
      killer.on("error", () => resolve(false));
      killer.on("close", () => resolve(true));
      return;
    }
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {}
    }
    resolve(true);
  });
}
