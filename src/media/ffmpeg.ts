import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";
import { ensureDir } from "@/utils/fs";
import type { Logger } from "@/utils/logger";

export interface TranscodeArgs {
  inputPath: string;
  outputPath: string;
  fps: number;
  width: number;
  height: number;
  crf: number;
}

/** Absolute path to the bundled ffmpeg binary. */
export function ffmpegPath(): string {
  const p = ffmpegStatic as unknown as string | null;
  if (!p) {
    throw new Error("ffmpeg-static did not provide a binary for this platform.");
  }
  return p;
}

/**
 * Build the ffmpeg argument vector to re-encode the recording into a web-friendly
 * h264 mp4 at a fixed fps. Pure — unit-tested.
 */
export function buildTranscodeArgs(args: TranscodeArgs): string[] {
  return [
    "-y",
    "-i",
    args.inputPath,
    "-vf",
    `scale=${args.width}:${args.height}:flags=lanczos,fps=${args.fps}`,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    String(args.crf),
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    args.outputPath,
  ];
}

/** Read a video's pixel dimensions by parsing ffmpeg's stream info (no ffprobe needed). */
export async function probeVideoDimensions(
  file: string,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath(), ["-hide_banner", "-i", file], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", () => resolve(null));
    // ffmpeg exits non-zero with no output file; the info we want is already on stderr.
    child.on("close", () => {
      const match = /,\s(\d+)x(\d+)[\s,]/.exec(stderr);
      resolve(match ? { width: Number(match[1]), height: Number(match[2]) } : null);
    });
  });
}

/** Re-encode the recorded webm into an mp4 at outputPath. */
export async function transcodeToMp4(
  args: TranscodeArgs & { logger?: Logger },
): Promise<void> {
  await ensureDir(path.dirname(args.outputPath));
  const bin = ffmpegPath();
  const argv = buildTranscodeArgs(args);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, argv, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      args.logger?.debug(text.trim());
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}:\n${stderr.slice(-2000)}`));
    });
  });
}
