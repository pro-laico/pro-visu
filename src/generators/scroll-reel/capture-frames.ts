import type { Browser } from "playwright-core";
import { captureFramedVideo } from "@/media/frame-capture";
import { prepareScroll, seekScrollTo } from "@/generators/scroll-reel/scroll";
import type { ResolvedScrollReelOptions } from "@/generators/scroll-reel/options";
import type { ResolvedTimeline } from "@/generators/scroll-reel/timeline";
import type { Logger } from "@/utils/logger";

/** Time at the bottom for lazy/below-the-fold content to load during the (un-recorded) warm-up pass. */
const PREWARM_SETTLE_MS = 700;

export interface ScrollFramesArgs {
  browser: Browser;
  url: string;
  options: ResolvedScrollReelOptions;
  /** Resolved scroll timeline; its `totalSeconds` is the clip length and `scrollAt(t)` the position. */
  timeline: ResolvedTimeline;
  /** Absolute mp4 path to write. */
  outPath: string;
  preset?: string;
  workers: number;
  frameFormat: "jpeg" | "png";
  jpegQuality: number;
  tmpDir: string;
  logger: Logger;
}

/**
 * Deterministic, frame-stepped recording of a real site. Each worker navigates + warms the page once
 * (reusing {@link prepareScroll} to trigger lazy content, fonts and image decode), then for every frame
 * sets the scroll position from the pure {@link timeline} via {@link seekScrollTo} and screenshots —
 * piped straight into ffmpeg by the shared {@link captureFramedVideo} harness. No realtime recording, no
 * dropped/jittered frames, no navigation lead to trim: only real content frames are emitted.
 */
export async function captureScrollFrames(a: ScrollFramesArgs): Promise<void> {
  const { options } = a;
  await captureFramedVideo({
    browser: a.browser,
    width: options.width,
    height: options.height,
    deviceScaleFactor: options.deviceScaleFactor,
    fps: options.fps,
    durationSeconds: a.timeline.totalSeconds,
    crf: options.crf,
    outPath: a.outPath,
    preset: a.preset,
    frameFormat: a.frameFormat,
    jpegQuality: a.jpegQuality,
    workers: a.workers,
    tmpDir: a.tmpDir,
    logger: a.logger,
    prepare: async (page, { logger }) => {
      logger.debug(`navigating to ${a.url} (waitUntil=${options.waitUntil})`);
      await page.goto(a.url, { waitUntil: options.waitUntil });
      if (options.waitForSelector) {
        logger.debug(`waiting for selector ${options.waitForSelector}`);
        await page.waitForSelector(options.waitForSelector, { state: "visible" });
      }
      // Warm-up (not recorded): load lazy content, fonts and images, then settle back at the top.
      await page.evaluate(prepareScroll, { settleMs: PREWARM_SETTLE_MS });
    },
    seekToFrame: async (page, t) => {
      await page.evaluate(seekScrollTo, { normalizedY: a.timeline.scrollAt(t) });
    },
  });
}
