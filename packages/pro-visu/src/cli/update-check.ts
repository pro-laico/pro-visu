import os from "node:os";
import pc from "picocolors";
import path from "node:path";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { TOOL_VERSION } from "@/version";

const PKG_NAME = "pro-visu";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Env flag that turns a CLI invocation into the detached background fetch worker. */
export const UPDATE_WORKER_FLAG = "PRO_VISU_UPDATE_WORKER";

interface UpdateCache {
  checkedAt: number;
  latest?: string;
}

function cacheFile(): string {
  return path.join(os.homedir(), ".cache", "pro-visu", "update-check.json");
}

function readCache(): UpdateCache | null {
  try {
    return JSON.parse(readFileSync(cacheFile(), "utf8")) as UpdateCache; //EXCUSE: JSON.parse returns `any`; a bad shape is caught/ignored by callers
  } catch {
    return null;
  }
}

/** Pure: is `latest` a strictly newer x.y.z than `current`? (Prerelease tags compare as 0.) */
export function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string): number[] => v.split(".").map((p) => parseInt(p, 10) || 0);
  const [a, b] = [parse(current), parse(latest)];
  for (let i = 0; i < 3; i++) {
    const d = (b[i] ?? 0) - (a[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** Pure: should the notice (or a new check) run at all in this environment? Unit-tested. */
export function updateCheckEnabled(env: NodeJS.ProcessEnv, argv: string[], version: string): boolean {
  if (version === "0.0.0-dev") return false;
  if (env.NO_UPDATE_NOTIFIER != null || env.NODE_ENV === "test" || env.CI != null) return false;
  if (argv.includes("--no-update-notifier")) return false;
  return true;
}

/**
 * Best-effort "a newer version is on npm" notice, dependency-free.
 *
 * Reads the previous run's cached registry result and, when a newer version exists, prints a short
 * notice as the process exits (the last thing on screen). When the cache is older than a day, a
 * detached background worker (this same CLI with {@link UPDATE_WORKER_FLAG} set) refreshes it for
 * the NEXT run — so the check never blocks, slows, or fails a command. Suppressed in CI, in tests,
 * with NO_UPDATE_NOTIFIER / --no-update-notifier, and for the unpublished dev build.
 */
export function checkForUpdates(version: string = TOOL_VERSION): void {
  try {
    if (!updateCheckEnabled(process.env, process.argv, version)) return;
    const cache = readCache();

    if (cache?.latest && isNewerVersion(version, cache.latest) && process.stderr.isTTY) {
      const latest = cache.latest;
      process.on("exit", () => {
        process.stderr.write(
          `\n${pc.yellow("Update available")} ${pc.dim(version)} → ${pc.green(latest)}\n` +
            `Run ${pc.cyan(`npm i ${PKG_NAME}@latest`)} (or your package manager's equivalent) to update.\n`,
        );
      });
    }

    if (!cache || Date.now() - cache.checkedAt > CHECK_INTERVAL_MS) {
      const child = spawn(process.execPath, [process.argv[1]!], {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, [UPDATE_WORKER_FLAG]: "1" },
      });
      child.unref();
    }
  } catch {}
}

/** The background worker body: fetch the latest version from npm and cache it. */
export async function runUpdateWorker(): Promise<void> {
  const cache: UpdateCache = { checkedAt: Date.now() };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(`https://registry.npmjs.org/${PKG_NAME}/latest`, {
      signal: ctrl.signal,
      headers: { accept: "application/vnd.npm.install-v1+json" },
    });
    clearTimeout(timer);
    if (res.ok) {
      const body = (await res.json()) as { version?: string }; //EXCUSE: res.json() is `any`; `version` is re-checked with typeof below
      if (typeof body.version === "string") cache.latest = body.version;
    }
  } catch {}
  try {
    mkdirSync(path.dirname(cacheFile()), { recursive: true });
    writeFileSync(cacheFile(), JSON.stringify(cache));
  } catch {}
}
