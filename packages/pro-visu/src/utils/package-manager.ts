import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/**
 * Sniff the project's package manager: the `packageManager` field wins, then the lockfile,
 * defaulting to npm. Used to piggyback on a project's own scripts (e.g. the managed server's
 * default build/start commands) so pro-visu follows whatever the repo already uses.
 */
export function detectPackageManager(cwd: string): PackageManager {
  let pkg: Record<string, unknown> = {};
  try {
    pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8")) as Record<string, unknown>;
  } catch {
    // best-effort: a missing/unparseable package.json just skips the `packageManager` field — detection falls through to the lockfile sniff / npm default
  }
  const pmField = typeof pkg.packageManager === "string" ? pkg.packageManager.split("@")[0] : "";
  if (pmField === "pnpm" || pmField === "yarn" || pmField === "bun" || pmField === "npm") return pmField;
  if (existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(path.join(cwd, "bun.lockb")) || existsSync(path.join(cwd, "bun.lock"))) return "bun";
  return "npm";
}

/** The project's own run command for a script ("npm run build" / "pnpm build" / "yarn start" / …). */
export function pmRun(pm: PackageManager, script: string): string {
  return pm === "npm" ? `npm run ${script}` : `${pm} ${script}`;
}
