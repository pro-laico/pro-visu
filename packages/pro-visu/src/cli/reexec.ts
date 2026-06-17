import { spawn } from "node:child_process";
import v8 from "node:v8";

/** Env flag set on the re-exec'd child so it doesn't try to re-exec again (infinite loop guard). */
const REEXEC_FLAG = "SHOWCASE_MEM_REEXEC";

/** This process's V8 old-space (heap) limit, in MB. */
export function currentHeapLimitMB(): number {
  return Math.round(v8.getHeapStatistics().heap_size_limit / (1024 * 1024));
}

/**
 * Whether a re-exec is warranted: a target is set, we haven't already re-exec'd, and it's
 * meaningfully above the current limit (5% slack avoids a pointless re-exec for a near-match).
 * Pure — unit-tested.
 */
export function shouldReexec(
  maxMemoryMB: number | undefined,
  currentLimitMB: number,
  alreadyReexec: boolean,
): boolean {
  if (!maxMemoryMB || maxMemoryMB <= 0) return false;
  if (alreadyReexec) return false;
  return currentLimitMB < maxMemoryMB * 0.95;
}

/**
 * Honor `settings.maxMemoryMB`: if it asks for more heap than this process has, re-exec the CLI with
 * `--max-old-space-size=<MB>` so a heavy run has room to finish instead of crashing with a V8 OOM.
 * Returns true if it re-exec'd — the child ran the whole command (stdio inherited), so the caller
 * should simply return. Signals are forwarded to the child so Esc/Ctrl+C still work.
 */
export async function reexecWithMemory(maxMemoryMB: number | undefined): Promise<boolean> {
  if (!shouldReexec(maxMemoryMB, currentHeapLimitMB(), process.env[REEXEC_FLAG] === "1")) {
    return false;
  }
  const args = [`--max-old-space-size=${maxMemoryMB}`, process.argv[1]!, ...process.argv.slice(2)];
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, [REEXEC_FLAG]: "1" },
  });
  const forward = (sig: NodeJS.Signals): void => {
    try {
      child.kill(sig);
    } catch {
      /* already gone */
    }
  };
  process.on("SIGINT", forward);
  process.on("SIGTERM", forward);
  const code = await new Promise<number>((resolve) => {
    child.on("exit", (c, signal) => resolve(c ?? (signal ? 1 : 0)));
    child.on("error", () => resolve(1));
  });
  process.off("SIGINT", forward);
  process.off("SIGTERM", forward);
  process.exitCode = code;
  return true;
}
