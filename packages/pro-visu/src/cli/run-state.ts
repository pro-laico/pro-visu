import path from "node:path";
import { readFile, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

/**
 * A small record of what a `pro-visu generate` run spawned, written to `<outDir>/.pro-visu-run.json`
 * and deleted on a clean exit. If the run is killed hard (Ctrl+C / crash), the file survives so
 * `pro-visu reset` can find and tear down the orphaned server + browser + temp dirs.
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
    return JSON.parse(await readFile(runStatePath(outDir), "utf8")) as RunState;
  } catch {
    return null;
  }
}

async function write(outDir: string, state: RunState): Promise<void> {
  try {
    await writeFile(runStatePath(outDir), `${JSON.stringify(state, null, 2)}\n`);
  } catch {
    /* best-effort — tracking is a convenience, never fail the run over it */
  }
}

export async function startRunState(outDir: string): Promise<void> {
  await write(outDir, { pid: process.pid, startedAt: new Date().toISOString(), tmpDirs: [] });
}

/** Merge a patch into the on-disk state (tmpDirs are appended, deduped). */
export async function updateRunState(outDir: string, patch: Partial<RunState>): Promise<void> {
  const cur = (await readRunState(outDir)) ?? {
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  const tmpDirs = [...new Set([...(cur.tmpDirs ?? []), ...(patch.tmpDirs ?? [])])];
  await write(outDir, { ...cur, ...patch, tmpDirs });
}

export async function clearRunState(outDir: string): Promise<void> {
  try {
    await rm(runStatePath(outDir), { force: true });
  } catch {
    /* already gone */
  }
}

/** Is a pid still running? */
export function isAlive(pid: number): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM"; // exists but not ours to signal
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
      process.kill(-pid, "SIGKILL"); // detached children are group leaders → kills the tree
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
    resolve(true);
  });
}
