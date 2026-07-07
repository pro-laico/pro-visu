import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { ffmpegPath } from "@/media/ffmpeg";
import { downloadFfmpeg, ffmpegIsSupported } from "@/binaries/ffmpeg-binary";
import type { Logger } from "@/utils/logger";

/** Does the managed ffmpeg binary exist AND actually execute on this platform? */
async function ffmpegWorks(): Promise<boolean> {
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

export interface EnsureFfmpegOptions {
  logger: Logger;
  /** When true, only report status; never download. */
  checkOnly?: boolean;
}

/**
 * Ensure a working ffmpeg binary. pro-visu ships no ffmpeg and depends on no `ffmpeg-static`, so we
 * fetch a prebuilt static binary on demand into a shared cache (mirroring how we fetch Chromium) —
 * consumers never approve a build script or install ffmpeg by hand. An explicit FFMPEG_BIN that
 * already runs is honored as-is and never overwritten.
 */
export async function ensureFfmpeg(opts: EnsureFfmpegOptions): Promise<boolean> {
  if (await ffmpegWorks()) return true;
  if (opts.checkOnly) return false;

  if (process.env.FFMPEG_BIN) {
    opts.logger.error(`FFMPEG_BIN is set to "${process.env.FFMPEG_BIN}" but that binary won't run.`);
    return false;
  }
  if (!ffmpegIsSupported()) {
    opts.logger.error(
      `No prebuilt ffmpeg for ${process.platform}/${process.arch}. Set FFMPEG_BIN to a local ffmpeg binary.`,
    );
    return false;
  }

  opts.logger.info("Fetching ffmpeg (one-time, ~80 MB)…");
  try {
    // Log at each quartile so a slow link shows life without spamming the log.
    let lastQuartile = 0;
    await downloadFfmpeg((downloaded, total) => {
      if (!total) return;
      const quartile = Math.floor((downloaded / total) * 4);
      if (quartile > lastQuartile && quartile < 4) {
        lastQuartile = quartile;
        const mb = (n: number): string => (n / 1024 / 1024).toFixed(0);
        opts.logger.info(`ffmpeg download: ${quartile * 25}% (${mb(downloaded)}/${mb(total)} MB)`);
      }
    });
  } catch (err) {
    opts.logger.error(`ffmpeg download failed: ${(err as Error).message}`);
    return false;
  }

  if (!(await ffmpegWorks())) {
    opts.logger.error("ffmpeg was downloaded but still won't run on this platform.");
    return false;
  }
  opts.logger.success("ffmpeg ready.");
  return true;
}
