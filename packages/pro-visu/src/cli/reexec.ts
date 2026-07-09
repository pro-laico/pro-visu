import os from "node:os";
import v8 from "node:v8";
import { spawn } from "node:child_process";

import type { ResolvedAssetSpec } from "@/config/schema";

/** Env flag set on the re-exec'd child so it doesn't try to re-exec again (infinite loop guard). */
const REEXEC_FLAG = "PRO_VISU_MEM_REEXEC";

/** This process's V8 old-space (heap) limit, in MB. */
export function currentHeapLimitMB(): number {
  return Math.round(v8.getHeapStatistics().heap_size_limit / (1024 * 1024));
}

/**
 * Pick a Node heap target for the selected plan, or undefined when the default is fine. Heavy
 * frame-stepped compositing jobs — real (non-test) walls — buffer frames across parallel workers
 * and can exceed Node's default ~4 GB old-space; everything else streams. The target is half the
 * machine's RAM, capped at 8 GB (the browser and ffmpeg need the rest). Pure given its inputs —
 * unit-tested via {@link shouldReexec}.
 */
export function autoHeapTargetMB(
  selected: Array<Pick<ResolvedAssetSpec, "generator" | "options">>,
  totalMemBytes: number = os.totalmem(),
): number | undefined {
  const heavy = selected.some(
    (s) => s.generator === "wall" && (s.options as { test?: unknown }).test !== true, //EXCUSE: probing one field of a generator-specific options union
  );
  if (!heavy) return undefined;
  return Math.min(8192, Math.floor(totalMemBytes / (1024 * 1024) / 2));
}

/**
 * Whether a re-exec is warranted: a target is set, we haven't already re-exec'd, and it's
 * meaningfully above the current limit (5% slack avoids a pointless re-exec for a near-match).
 * Pure — unit-tested.
 */
export function shouldReexec(targetMB: number | undefined, currentLimitMB: number, alreadyReexec: boolean): boolean {
  if (!targetMB || targetMB <= 0) return false;
  if (alreadyReexec) return false;
  return currentLimitMB < targetMB * 0.95;
}

/**
 * Give a heavy run more heap automatically: when the plan warrants more than this process has,
 * re-exec the CLI with `--max-old-space-size=<MB>` so the run finishes instead of crashing with a
 * V8 OOM. Returns true if it re-exec'd — the child ran the whole command (stdio inherited), so the
 * caller should simply return. Signals are forwarded to the child so Esc/Ctrl+C still work.
 */
export async function reexecWithMemory(targetMB: number | undefined): Promise<boolean> {
  if (!shouldReexec(targetMB, currentHeapLimitMB(), process.env[REEXEC_FLAG] === "1")) return false;
  const args = [`--max-old-space-size=${targetMB}`, process.argv[1]!, ...process.argv.slice(2)];
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, [REEXEC_FLAG]: "1" },
  });
  const forward = (sig: NodeJS.Signals): void => {
    try {
      child.kill(sig);
    } catch {}
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
