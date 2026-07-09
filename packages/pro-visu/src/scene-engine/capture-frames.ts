import type { Browser } from "playwright-core";

import type { Logger } from "@/utils/logger";
import { captureFramedVideo } from "@/recorder/frame-capture";

export interface FrameCaptureArgs {
  browser: Browser;
  url: string;
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
  /** Fractional progress (0–1) as frames complete. */
  onProgress?: (fraction: number) => void;
  /** Cancels the capture mid-flight. */
  signal?: AbortSignal;
}

/**
 * Deterministic scene capture: drives the scene-app's `window.__showcase` timeline. Each frame seeks
 * the scene to its exact time, screenshots, and pipes into ffmpeg — frame-accurate and machine-
 * independent. This is now a thin adapter over the shared {@link captureFramedVideo} harness; the only
 * scene-specific parts are the readiness wait and the per-frame `seek(t)`.
 */
export async function captureSceneFrames(args: FrameCaptureArgs): Promise<void> {
  await captureFramedVideo({
    browser: args.browser,
    width: args.width,
    height: args.height,
    deviceScaleFactor: args.deviceScaleFactor,
    fps: args.fps,
    durationSeconds: args.durationSeconds,
    crf: args.crf,
    outPath: args.outPath,
    preset: args.preset,
    frameFormat: args.frameFormat,
    jpegQuality: args.jpegQuality,
    workers: args.workers,
    tmpDir: args.tmpDir,
    logger: args.logger,
    onProgress: args.onProgress,
    signal: args.signal,
    prepare: async (page) => {
      await page.goto(args.url, { waitUntil: "load" });
      //TODO: replace `as` cast with proper typing
      await page.waitForFunction(
        () => (globalThis as { __showcaseReady?: boolean }).__showcaseReady === true,
        undefined,
        { timeout: 30_000 },
      );
    },
    seekToFrame: async (page, t) => {
      //TODO: replace `as` cast with proper typing
      await page.evaluate((tt) => (globalThis as { __showcase?: { seek(t: number): Promise<void> } }).__showcase?.seek(tt), t);
    },
  });
}
