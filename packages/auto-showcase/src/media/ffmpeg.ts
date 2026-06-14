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
  /** Crop the source to this box (CSS px) before scaling — used for element-focused clips. */
  crop?: { x: number; y: number; width: number; height: number };
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
  const crop = args.crop
    ? `crop=${args.crop.width}:${args.crop.height}:${args.crop.x}:${args.crop.y},`
    : "";
  return [
    "-y",
    ...seek,
    "-i",
    args.inputPath,
    "-vf",
    `${crop}scale=${args.width}:${args.height}:flags=lanczos:${SCALE_COLOR},format=yuv420p,fps=${args.fps}`,
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

/** Read a video's duration in ms by parsing ffmpeg's stream info (no ffprobe needed). */
export async function probeVideoDurationMs(file: string): Promise<number | null> {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath(), ["-hide_banner", "-i", file], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", () => resolve(null));
    child.on("close", () => {
      const m = /Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/.exec(stderr);
      if (!m) return resolve(null);
      const frac = Number(`0.${m[4]}`);
      resolve((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + frac) * 1000);
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

// --- output transforms: aspect reframing + alternate formats (gif / webp / poster) ---

export type AspectPreset = "16:9" | "9:16" | "1:1";

/** Pure: resolve an aspect preset (or explicit size) to concrete output pixel dimensions. */
export function aspectTarget(
  aspect: AspectPreset | { width: number; height: number },
): { width: number; height: number } {
  if (typeof aspect === "object") return { width: aspect.width, height: aspect.height };
  switch (aspect) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "16:9":
    default:
      return { width: 1920, height: 1080 };
  }
}

export interface AspectArgs {
  inputPath: string;
  outputPath: string;
  width: number;
  height: number;
  /** "cover" scales to fill + center-crops; "contain" scales to fit + pads. */
  fit: "cover" | "contain";
  padColor: string;
  fps: number;
  crf: number;
  preset?: string;
}

/** ffmpeg argv to reframe a video to a target aspect (h264, bt709 preserved). Pure — unit-tested. */
export function buildAspectArgs(a: AspectArgs): string[] {
  const vf =
    a.fit === "contain"
      ? `scale=${a.width}:${a.height}:force_original_aspect_ratio=decrease:flags=lanczos:${SCALE_COLOR},` +
        `pad=${a.width}:${a.height}:(ow-iw)/2:(oh-ih)/2:${a.padColor},format=yuv420p`
      : `scale=${a.width}:${a.height}:force_original_aspect_ratio=increase:flags=lanczos:${SCALE_COLOR},` +
        `crop=${a.width}:${a.height},format=yuv420p`;
  return [
    "-y",
    "-i",
    a.inputPath,
    "-vf",
    vf,
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
    a.outputPath,
  ];
}

export interface GifArgs {
  inputPath: string;
  outputPath: string;
  fps: number;
  /** Optional output width (height auto, keeps aspect). */
  width?: number;
}

/** ffmpeg argv to encode an optimized GIF (per-clip palette). Pure — unit-tested. */
export function buildGifArgs(a: GifArgs): string[] {
  const scale = a.width ? `,scale=${a.width}:-1:flags=lanczos` : "";
  const filter =
    `[0:v] fps=${a.fps}${scale},split [s0][s1];` +
    `[s0] palettegen=stats_mode=diff [p];[s1][p] paletteuse=dither=bayer:bayer_scale=5`;
  return ["-y", "-i", a.inputPath, "-filter_complex", filter, a.outputPath];
}

export interface WebpArgs {
  inputPath: string;
  outputPath: string;
  fps: number;
  /** 0–100 (libwebp q:v). */
  quality: number;
}

/** ffmpeg argv to encode an animated WebP. Pure — unit-tested. */
export function buildWebpArgs(a: WebpArgs): string[] {
  return [
    "-y",
    "-i",
    a.inputPath,
    "-vcodec",
    "libwebp",
    "-filter:v",
    `fps=${a.fps}`,
    "-lossless",
    "0",
    "-q:v",
    String(a.quality),
    "-loop",
    "0",
    "-an",
    "-vsync",
    "0",
    a.outputPath,
  ];
}

export interface PosterArgs {
  inputPath: string;
  outputPath: string;
  /** Seek to this time (seconds) before grabbing one frame. */
  atSeconds: number;
}

/** ffmpeg argv to grab a single still frame (poster/thumbnail). Pure — unit-tested. */
export function buildPosterArgs(a: PosterArgs): string[] {
  const seek = a.atSeconds > 0 ? ["-ss", a.atSeconds.toFixed(3)] : [];
  return ["-y", ...seek, "-i", a.inputPath, "-frames:v", "1", a.outputPath];
}

export interface StillSegmentArgs {
  pngPath: string;
  outPath: string;
  seconds: number;
  fps: number;
  width: number;
  height: number;
  /** Fade-from-black duration at the start (s); 0 to disable. */
  fadeInSec: number;
  /** Fade-to-black duration at the end (s); 0 to disable. */
  fadeOutSec: number;
  crf: number;
  preset?: string;
}

/**
 * ffmpeg argv to turn a still PNG into a fixed-length mp4 segment with optional fade in/out — used for
 * intro/outro cards. Same h264 / bt709 / yuv420p settings as the main clip so segments concat cleanly.
 * Pure — unit-tested.
 */
export function buildStillSegmentArgs(a: StillSegmentArgs): string[] {
  const filters = [`scale=${a.width}:${a.height}:flags=lanczos:${SCALE_COLOR}`, "format=yuv420p"];
  if (a.fadeInSec > 0) filters.push(`fade=t=in:st=0:d=${a.fadeInSec.toFixed(3)}`);
  if (a.fadeOutSec > 0) {
    filters.push(`fade=t=out:st=${Math.max(0, a.seconds - a.fadeOutSec).toFixed(3)}:d=${a.fadeOutSec.toFixed(3)}`);
  }
  return [
    "-y",
    "-loop",
    "1",
    "-t",
    a.seconds.toFixed(3),
    "-i",
    a.pngPath,
    "-vf",
    filters.join(","),
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
