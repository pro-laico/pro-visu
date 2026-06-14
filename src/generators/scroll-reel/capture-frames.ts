import type { Browser } from "playwright-core";
import { captureFramedVideo } from "@/media/frame-capture";
import { prepareScroll, seekScrollTo, settleInView } from "@/generators/scroll-reel/scroll";
import { applyPostNav, installPreNav } from "@/generators/scroll-reel/clean-capture";
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
  /** Wait for fonts + in-view images before each frame (resolved: defaults on, off in draft). */
  settlePerFrame: boolean;
  /** Max ms to wait per frame for settling before screenshotting anyway. */
  settleMaxMs: number;
  tmpDir: string;
  logger: Logger;
}

/**
 * Deterministic, frame-stepped recording of a real site. Each worker navigates + warms the page once
 * (reusing {@link prepareScroll} to trigger lazy content, fonts and image decode), applies clean-capture
 * suppression, then for every frame sets the scroll position from the pure {@link ResolvedTimeline} via
 * {@link seekScrollTo}, optionally settles in-view content, and screenshots — piped straight into ffmpeg
 * by the shared {@link captureFramedVideo} harness. No realtime recording, no dropped/jittered frames,
 * no navigation lead to trim: only real content frames are emitted.
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
      // Pre-navigation hooks (e.g. freeze the clock) must be installed before page scripts run.
      await installPreNav(page, options);
      logger.debug(`navigating to ${a.url} (waitUntil=${options.waitUntil})`);
      await page.goto(a.url, { waitUntil: options.waitUntil });
      if (options.waitForSelector) {
        logger.debug(`waiting for selector ${options.waitForSelector}`);
        await page.waitForSelector(options.waitForSelector, { state: "visible" });
      }
      // Suppress capture noise (hide banners/scrollbars, inject CSS, dismiss consent overlays).
      await applyPostNav(page, options, logger);
      // Warm-up (not recorded): load lazy content, fonts and images, then settle back at the top.
      await page.evaluate(prepareScroll, { settleMs: PREWARM_SETTLE_MS });
    },
    seekToFrame: async (page, t) => {
      await page.evaluate(seekScrollTo, { normalizedY: a.timeline.scrollAt(t) });
      if (a.settlePerFrame) {
        // Bound the in-page settle Node-side so a stuck decode can't hang the frame.
        await Promise.race([
          page.evaluate(settleInView),
          new Promise<void>((resolve) => setTimeout(resolve, a.settleMaxMs)),
        ]);
      }
    },
  });
}
