import os from "node:os";
import path from "node:path";
import type { Browser, Page } from "playwright-core";
import { concatMp4, startFrameEncoder } from "@/media/ffmpeg";
import { ensureDir } from "@/utils/fs";
import type { Logger } from "@/utils/logger";

/**
 * Deterministic frame-stepped video capture, shared by every "step a clock and screenshot" path
 * (the `scene` subsystem and site recording). The only per-path differences are two callbacks:
 *   - `prepare`   — runs once per worker context (navigate, wait for readiness/warm-up); returns
 *                   opaque per-page state passed back to `seekToFrame`.
 *   - `seekToFrame` — advance the page to clip-time `t` (seconds) before the screenshot.
 *
 * Everything else (frame timing, parallel workers, supersample-then-encode, lossless concat) is the
 * machine-independent core: frame N is a pure function of `t`, so splitting the range across worker
 * contexts and concatenating is safe. Frames never touch disk — they pipe straight into ffmpeg.
 */
export interface FrameStepArgs<S = unknown> {
  browser: Browser;
  /** Viewport + screenshot size; supersampled by `deviceScaleFactor`, downscaled in ffmpeg. */
  width: number;
  height: number;
  deviceScaleFactor: number;
  fps: number;
  durationSeconds: number;
  crf: number;
  /** Absolute mp4 path to write. */
  outPath: string;
  /** "ultrafast" in draft, "medium" otherwise. */
  preset?: string;
  /** Intermediate frame format; "png" is lossless into the encoder. Default "jpeg". */
  frameFormat?: "jpeg" | "png";
  /** JPEG quality for intermediate frames (perf vs fidelity; ignored for png). */
  jpegQuality?: number;
  /** Parallel render workers (each its own browser context). Default 1. */
  workers?: number;
  /** Scratch dir for per-worker segments. */
  tmpDir: string;
  logger: Logger;
  /** Runs once per worker context (after newContext/newPage). Returns opaque per-page state. */
  prepare: (page: Page, helpers: { logger: Logger }) => Promise<S>;
  /** Advance the page to clip-time `t` (seconds) before the screenshot. */
  seekToFrame: (page: Page, t: number, state: S) => Promise<void>;
}

/** Default parallel workers: about half the cores, capped at 6 (each is a browser context). */
export function autoWorkers(): number {
  const cores = os.cpus()?.length ?? 2;
  return Math.max(1, Math.min(6, Math.floor(cores / 2)));
}

/**
 * Pure: split `totalFrames` into at most `workers` contiguous, non-overlapping [start, end) ranges
 * that exactly tile [0, totalFrames). Unit-tested (the I/O loop around it is exercised elsewhere).
 */
export function planFrames(totalFrames: number, workers: number): Array<{ start: number; end: number }> {
  const w = Math.max(1, Math.min(workers, totalFrames));
  const chunk = Math.ceil(totalFrames / w);
  const ranges: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < w; i++) {
    const start = i * chunk;
    const end = Math.min(totalFrames, start + chunk);
    if (start >= end) break;
    ranges.push({ start, end });
  }
  return ranges;
}

interface ChunkArgs<S> {
  browser: Browser;
  width: number;
  height: number;
  deviceScaleFactor: number;
  fps: number;
  crf: number;
  preset?: string;
  frameFormat: "jpeg" | "png";
  jpegQuality: number;
  /** Seconds advanced per frame (duration / totalFrames) — see captureFramedVideo. */
  timeStep: number;
  /** Inclusive start frame, exclusive end frame. */
  frameStart: number;
  frameEnd: number;
  outPath: string;
  logger: Logger;
  prepare: (page: Page, helpers: { logger: Logger }) => Promise<S>;
  seekToFrame: (page: Page, t: number, state: S) => Promise<void>;
}

/** Render a contiguous frame range in its own browser context, encoding to one mp4 segment. */
async function renderChunk<S>(a: ChunkArgs<S>): Promise<void> {
  const context = await a.browser.newContext({
    viewport: { width: a.width, height: a.height },
    deviceScaleFactor: a.deviceScaleFactor,
  });
  const page = await context.newPage();
  page.on("console", (m) => a.logger.debug(`[capture] ${m.text()}`));
  page.on("pageerror", (e) => a.logger.debug(`[capture error] ${e.message}`));

  try {
    const state = await a.prepare(page, { logger: a.logger });

    const encoder = startFrameEncoder(
      {
        fps: a.fps,
        width: a.width,
        height: a.height,
        crf: a.crf,
        outPath: a.outPath,
        preset: a.preset,
        inputFormat: a.frameFormat,
      },
      a.logger,
    );
    // Playwright rejects `quality` for png screenshots, so only pass it on the jpeg path.
    const shotOptions =
      a.frameFormat === "png"
        ? ({ type: "png" } as const)
        : ({ type: "jpeg", quality: a.jpegQuality } as const);
    for (let frame = a.frameStart; frame < a.frameEnd; frame++) {
      const t = frame * a.timeStep;
      await a.seekToFrame(page, t, state);
      const buf = await page.screenshot(shotOptions);
      await encoder.write(buf);
    }
    await encoder.done();
  } finally {
    await context.close();
  }
}

/**
 * Step each frame to its exact time via `seekToFrame`, screenshot, and pipe straight into ffmpeg —
 * frame-accurate and machine-independent, no frames touch disk. With `workers > 1`, the frame range is
 * split into contiguous segments rendered in parallel contexts, then losslessly concatenated (the
 * determinism is what makes this safe).
 */
export async function captureFramedVideo<S>(args: FrameStepArgs<S>): Promise<void> {
  await ensureDir(path.dirname(args.outPath));
  const totalFrames = Math.max(1, Math.round(args.durationSeconds * args.fps));
  // Step time as duration/totalFrames (≈ 1/fps) so the N frames evenly tile [0, duration). The frame
  // that would sit at t=duration is the loop point — which equals t=0 for a seamless clip — so omitting
  // it (we render 0..N-1) makes the last→first wrap exactly one step: no seam hitch.
  const timeStep = args.durationSeconds / totalFrames;
  const frameFormat = args.frameFormat ?? "jpeg";
  const jpegQuality = args.jpegQuality ?? 90;
  const ranges = planFrames(totalFrames, Math.max(1, args.workers ?? 1));
  const common = {
    browser: args.browser,
    width: args.width,
    height: args.height,
    deviceScaleFactor: args.deviceScaleFactor,
    fps: args.fps,
    crf: args.crf,
    preset: args.preset,
    frameFormat,
    jpegQuality,
    timeStep,
    logger: args.logger,
    prepare: args.prepare,
    seekToFrame: args.seekToFrame,
  };

  if (ranges.length === 1) {
    args.logger.debug(`stepping ${totalFrames} frames @ ${args.fps}fps`);
    await renderChunk({ ...common, frameStart: 0, frameEnd: totalFrames, outPath: args.outPath });
    return;
  }

  const segs = ranges.map((r, i) => ({
    ...r,
    seg: path.join(args.tmpDir, `seg-${i}-${path.basename(args.outPath)}`),
  }));
  args.logger.debug(`stepping ${totalFrames} frames across ${segs.length} workers`);
  await Promise.all(
    segs.map((r) =>
      renderChunk({ ...common, frameStart: r.start, frameEnd: r.end, outPath: r.seg }),
    ),
  );
  await concatMp4(
    segs.map((r) => r.seg),
    args.outPath,
    args.logger,
  );
}
