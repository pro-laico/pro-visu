import path from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";
import type { Logger } from "@/utils/logger";

const require = createRequire(import.meta.url);

/** Is a managed Chromium present on disk for playwright-core? */
function isChromiumInstalled(): boolean {
  try {
    const exe = chromium.executablePath();
    return !!exe && existsSync(exe);
  } catch {
    return false;
  }
}

/** Locate playwright-core's CLI so we can drive its browser installer. */
function resolveCliPath(): string {
  try {
    return require.resolve("playwright-core/cli.js");
  } catch {
    const pkgJson = require.resolve("playwright-core/package.json");
    return path.join(path.dirname(pkgJson), "cli.js");
  }
}

export interface EnsureChromiumOptions {
  logger: Logger;
  /** When true, only report status; never install. */
  checkOnly?: boolean;
}

/**
 * Ensure a Chromium build is available. playwright-core ships no browser at install time,
 * so we fetch it on demand (cached in the shared PLAYWRIGHT_BROWSERS_PATH). Returns whether
 * Chromium is present afterward.
 */
export async function ensureChromium(opts: EnsureChromiumOptions): Promise<boolean> {
  if (isChromiumInstalled()) return true;
  if (opts.checkOnly) return false;

  opts.logger.info("Installing Chromium for Playwright (one-time, ~100–150 MB)…");
  const cli = resolveCliPath();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [cli, "install", "chromium"], {
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `Chromium install failed (exit code ${code}). If you're offline or behind a proxy, ` +
                `set HTTPS_PROXY, or point PLAYWRIGHT_DOWNLOAD_HOST at a mirror.`,
            ),
          ),
    );
  });
  opts.logger.success("Chromium installed.");
  return true;
}
