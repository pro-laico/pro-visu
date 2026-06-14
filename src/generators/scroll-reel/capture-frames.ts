import type { Browser, Page } from "playwright-core";
import { captureFramedVideo } from "@/media/frame-capture";
import {
  measureNormalizedOffsets,
  prepareScroll,
  seekScrollTo,
  settleInView,
} from "@/generators/scroll-reel/scroll";
import { applyPostNav, installPreNav } from "@/generators/scroll-reel/clean-capture";
import {
  choreographyTimelineSpec,
  clamp01,
  defaultTimelineSpec,
  resolveTimeline,
  scrollTimelineTotalMs,
  DEFAULT_STEP_DURATION_MS,
  DEFAULT_STEP_HOLD_MS,
  type ResolvedChoreographyStep,
  type ResolvedTimeline,
} from "@/generators/scroll-reel/timeline";
import type { ResolvedScrollReelOptions } from "@/generators/scroll-reel/options";
import type { Logger } from "@/utils/logger";

/** Time at the bottom for lazy/below-the-fold content to load during the (un-recorded) warm-up pass. */
const PREWARM_SETTLE_MS = 700;

export interface ScrollFramesArgs {
  browser: Browser;
  url: string;
  options: ResolvedScrollReelOptions;
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
 * Build the resolved scroll timeline for this capture. The default (no `choreography`) is a pure Node
 * computation; with choreography, selector targets are measured against the (warmed-up) page so the
 * positions are real and stable. Run once per worker inside `prepare`; since the measurements are
 * deterministic, every worker produces the same timeline.
 */
async function buildScrollTimeline(
  page: Page,
  options: ResolvedScrollReelOptions,
  totalSeconds: number,
  logger: Logger,
): Promise<ResolvedTimeline> {
  const steps = options.choreography;
  if (!steps || steps.length === 0) {
    return resolveTimeline(
      defaultTimelineSpec({
        startDelayMs: options.startDelayMs,
        durationMs: options.duration,
        endDwellMs: options.endDwellMs,
        easing: options.easing,
      }),
      totalSeconds,
    );
  }

  // Resolve selector targets in one in-page pass; numbers and "NN%" resolve in Node.
  const selectors = steps
    .map((s) => s.to)
    .filter((to): to is string => typeof to === "string" && !to.trim().endsWith("%"));
  const measured =
    selectors.length > 0
      ? await page.evaluate(measureNormalizedOffsets, { selectors })
      : [];

  let mi = 0;
  let prevY = 0;
  const resolved: ResolvedChoreographyStep[] = steps.map((s) => {
    let toY: number;
    if (typeof s.to === "number") {
      toY = clamp01(s.to);
    } else if (s.to.trim().endsWith("%")) {
      toY = clamp01(parseFloat(s.to) / 100);
    } else {
      const m = measured[mi++];
      if (m == null) {
        logger.warn(`choreography: selector "${s.to}" not found — holding position`);
        toY = prevY;
      } else {
        toY = clamp01(m);
      }
    }
    prevY = toY;
    return {
      toY,
      durationMs: s.durationMs ?? DEFAULT_STEP_DURATION_MS,
      holdMs: s.holdMs ?? DEFAULT_STEP_HOLD_MS,
      easing: s.easing ?? options.easing,
    };
  });

  return resolveTimeline(
    choreographyTimelineSpec({
      startDelayMs: options.startDelayMs,
      endDwellMs: options.endDwellMs,
      steps: resolved,
    }),
    totalSeconds,
  );
}

/**
 * Deterministic, frame-stepped recording of a real site. Each worker navigates + warms the page once
 * (reusing {@link prepareScroll} to trigger lazy content, fonts and image decode), applies clean-capture
 * suppression, builds the scroll timeline (resolving any choreography selectors against the page), then
 * for every frame sets the scroll position via {@link seekScrollTo}, optionally settles in-view content,
 * and screenshots — piped straight into ffmpeg by the shared {@link captureFramedVideo} harness. No
 * realtime recording, no dropped/jittered frames, no navigation lead to trim.
 */
export async function captureScrollFrames(a: ScrollFramesArgs): Promise<void> {
  const { options } = a;
  const totalSeconds = scrollTimelineTotalMs(options) / 1000;
  await captureFramedVideo<ResolvedTimeline>({
    browser: a.browser,
    width: options.width,
    height: options.height,
    deviceScaleFactor: options.deviceScaleFactor,
    fps: options.fps,
    durationSeconds: totalSeconds,
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
      // Resolve the timeline against the (now stable) page; deterministic across workers.
      return buildScrollTimeline(page, options, totalSeconds, logger);
    },
    seekToFrame: async (page, t, timeline) => {
      await page.evaluate(seekScrollTo, { normalizedY: timeline.scrollAt(t) });
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
