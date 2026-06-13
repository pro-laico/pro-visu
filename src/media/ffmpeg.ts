import path from "node:path";
import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
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
  /** x264 speed/size tradeoff; "ultrafast" for draft, "medium" (default) for final. */
  preset?: string;
  /** Seconds to trim off the head of the input (e.g. the blank navigation lead of a recording). */
  startOffsetSeconds?: number;
  /** Clamp the output to exactly this many seconds (after any head trim) so length is deterministic. */
  durationSeconds?: number;
}

/**
 * Color correctness: every encode converts to and TAGS bt709 limited (tv) range — the standard for
 * web/HD video. Untagged output forces players to guess the matrix (bt601 vs bt709), which shifts
 * colors subtly; explicit conversion + tagging keeps brand colors exact everywhere.
 *
 * `SCALE_COLOR` goes on the scale filter (which performs the conversion); `format=yuv420p` must
 * directly follow scale in the chain so scale itself does the RGB→YUV conversion with the declared
 * matrix (for RGB inputs like PNG frames/overlays, a later auto-inserted converter would otherwise
 * use an unspecified matrix). `COLOR_TAGS` writes the matching metadata into the x264 VUI/container.
 */
export const SCALE_COLOR = "out_color_matrix=bt709:out_range=tv";
export const COLOR_TAGS = [
  "-colorspace",
  "bt709",
  "-color_primaries",
  "bt709",
  "-color_trc",
  "bt709",
  "-color_range",
  "tv",
];

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
  // Input-side seek (`-ss` before `-i`) skips the blank navigation/readiness lead Playwright records
  // before playback starts, so the mp4 opens on the first real frame instead of a blank one.
  const seek =
    args.startOffsetSeconds && args.startOffsetSeconds > 0
      ? ["-ss", args.startOffsetSeconds.toFixed(3)]
      : [];
  // Output-side limit (after the head seek) so the clip is exactly `durationSeconds` long.
  const limit =
    args.durationSeconds && args.durationSeconds > 0
      ? ["-t", args.durationSeconds.toFixed(3)]
      : [];
  return [
    "-y",
    ...seek,
    "-i",
    args.inputPath,
    "-vf",
    `scale=${args.width}:${args.height}:flags=lanczos:${SCALE_COLOR},format=yuv420p,fps=${args.fps}`,
    "-c:v",
    "libx264",
    "-preset",
    args.preset ?? "medium",
    "-crf",
    String(args.crf),
    "-pix_fmt",
    "yuv420p",
    ...COLOR_TAGS,
    "-movflags",
    "+faststart",
    "-an",
    ...limit,
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
    // ffmpeg exits non-zero with no output file; the info we want is already on stderr. Anchor to
    // the video stream line so a "1920x1080"-looking tag on another line can't be picked up first.
    child.on("close", () => {
      const videoLine = stderr.split("\n").find((l) => l.includes("Video:"));
      const match = videoLine ? /,\s(\d+)x(\d+)[\s,]/.exec(videoLine) : null;
      resolve(match ? { width: Number(match[1]), height: Number(match[2]) } : null);
    });
  });
}

export interface FramePipeArgs {
  fps: number;
  width: number;
  height: number;
  crf: number;
  outPath: string;
  /** x264 speed/size tradeoff; "ultrafast" for draft, "medium" for final. */
  preset?: string;
  /** Piped frame format; "png" is the lossless (slower) path. Default "jpeg". */
  inputFormat?: "jpeg" | "png";
}

/**
 * ffmpeg argv to encode a stream of image frames (image2pipe on stdin) into an mp4. Pure —
 * unit-tested. Frames are scaled to the output size so we can screenshot at a higher device
 * scale and downsample for crispness. The input codec is set explicitly (mjpeg/png) rather than
 * relying on pipe content probing, so behavior is deterministic.
 */
export function buildFramePipeArgs(a: FramePipeArgs): string[] {
  return [
    "-y",
    "-f",
    "image2pipe",
    "-framerate",
    String(a.fps),
    "-c:v",
    a.inputFormat === "png" ? "png" : "mjpeg",
    "-i",
    "pipe:0",
    "-vf",
    `scale=${a.width}:${a.height}:flags=lanczos:${SCALE_COLOR},format=yuv420p`,
    "-r",
    String(a.fps),
    "-c:v",
    "libx264",
    "-preset",
    a.preset ?? "medium",
    "-crf",
    String(a.crf),
    "-pix_fmt",
    "yuv420p",
    ...COLOR_TAGS,
    "-movflags",
    "+faststart",
    "-an",
    a.outPath,
  ];
}

export interface FrameEncoder {
  /** Push one encoded frame (JPEG buffer), respecting backpressure. */
  write(frame: Buffer): Promise<void>;
  /** Flush + wait for ffmpeg to finish writing the mp4. */
  done(): Promise<void>;
}

/** Spawn an ffmpeg that consumes piped JPEG frames and writes an mp4 — no frames hit disk. */
export function startFrameEncoder(a: FramePipeArgs, logger?: Logger): FrameEncoder {
  const child = spawn(ffmpegPath(), buildFramePipeArgs(a), {
    stdio: ["pipe", "ignore", "pipe"],
  });
  let stderr = "";
  let failed: Error | null = null;
  child.stderr.on("data", (d: Buffer) => {
    stderr += d.toString();
    logger?.debug(d.toString().trim());
  });
  child.on("error", (e) => {
    failed = e;
  });
  const stdin = child.stdin;

  return {
    write: (frame) =>
      new Promise<void>((resolve, reject) => {
        if (failed) return reject(failed);
        const flushed = stdin.write(frame, (err) => {
          if (err) reject(err);
        });
        if (flushed) resolve();
        else stdin.once("drain", resolve);
      }),
    done: () =>
      new Promise<void>((resolve, reject) => {
        stdin.end();
        child.on("close", (code) =>
          code === 0
            ? resolve()
            : reject(new Error(`ffmpeg frame encode failed (${code}):\n${stderr.slice(-2000)}`)),
        );
      }),
  };
}

/** ffmpeg argv to losslessly concat mp4 segments (same codec params) via the concat demuxer. */
export function buildConcatArgs(listFile: string, outPath: string): string[] {
  return [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFile,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    outPath,
  ];
}

/** Concatenate mp4 segments into one file (stream copy — no re-encode). */
export async function concatMp4(
  segments: string[],
  outPath: string,
  logger?: Logger,
): Promise<void> {
  await ensureDir(path.dirname(outPath));
  // concat demuxer wants forward slashes and single-quoted paths.
  const listFile = `${outPath}.concat.txt`;
  const list = segments.map((s) => `file '${s.replace(/\\/g, "/")}'`).join("\n");
  await writeFile(listFile, `${list}\n`, "utf8");
  try {
    await runFfmpeg(buildConcatArgs(listFile, outPath), logger);
  } finally {
    await rm(listFile, { force: true });
  }
}

/** Run ffmpeg with an explicit argv, rejecting on a non-zero exit. */
export async function runFfmpeg(argv: string[], logger?: Logger): Promise<void> {
  const bin = ffmpegPath();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, argv, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      logger?.debug(text.trim());
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}:\n${stderr.slice(-2000)}`));
    });
  });
}

/** Re-encode the recorded webm into an mp4 at outputPath. */
export async function transcodeToMp4(
  args: TranscodeArgs & { logger?: Logger },
): Promise<void> {
  await ensureDir(path.dirname(args.outputPath));
  await runFfmpeg(buildTranscodeArgs(args), args.logger);
}
