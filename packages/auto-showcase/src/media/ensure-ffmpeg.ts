import path from "node:path";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { ffmpegPath } from "@/media/ffmpeg";
import type { Logger } from "@/utils/logger";

const require = createRequire(import.meta.url);

/** Does the bundled ffmpeg binary exist AND actually execute on this platform? */
export async function ffmpegWorks(): Promise<boolean> {
  let bin: string;
  try {
    bin = ffmpegPath();
  } catch {
    return false;
  }
  if (!existsSync(bin)) return false;
  return await new Promise<boolean>((resolve) => {
    // A corrupt / wrong-platform binary fails here — on Windows spawn() throws synchronously
    // (spawn UNKNOWN/EFTYPE); on POSIX it emits an async 'error'. Handle both.
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(bin, ["-version"], { stdio: "ignore" });
    } catch {
      resolve(false);
      return;
    }
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

/** Locate ffmpeg-static's bundled downloader script. */
function resolveInstallScript(): string | null {
  try {
    return require.resolve("ffmpeg-static/install.js");
  } catch {
    try {
      const pkg = require.resolve("ffmpeg-static/package.json");
      return path.join(path.dirname(pkg), "install.js");
    } catch {
      return null;
    }
  }
}

export interface EnsureFfmpegOptions {
  logger: Logger;
  /** When true, only report status; never download. */
  checkOnly?: boolean;
}

/**
 * Ensure a working ffmpeg binary. ffmpeg-static fetches its binary via a postinstall script,
 * which pnpm/npm block unless the consumer approves build scripts — leaving the binary
 * missing or corrupt so it fails to spawn (EFTYPE). We self-heal by running ffmpeg-static's
 * own downloader on demand (mirroring how we fetch Chromium), so consumers never have to
 * approve build scripts or install ffmpeg by hand.
 */
export async function ensureFfmpeg(opts: EnsureFfmpegOptions): Promise<boolean> {
  if (await ffmpegWorks()) return true;
  if (opts.checkOnly) return false;

  const installScript = resolveInstallScript();
  if (!installScript) {
    opts.logger.error("ffmpeg-static is not installed; cannot fetch an ffmpeg binary.");
    return false;
  }

  opts.logger.info("Fetching ffmpeg (one-time, ~80 MB)…");
  // ffmpeg-static's installer treats any existing file as already-done, so clear a corrupt
  // binary first to force a clean re-download.
  try {
    await rm(ffmpegPath(), { force: true });
  } catch {
    /* path may not resolve yet — the download recreates it */
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [installScript], {
      cwd: path.dirname(installScript),
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg download failed (exit code ${code}).`)),
    );
  });

  if (!(await ffmpegWorks())) {
    opts.logger.error("ffmpeg was downloaded but still won't run on this platform.");
    return false;
  }
  opts.logger.success("ffmpeg ready.");
  return true;
}
