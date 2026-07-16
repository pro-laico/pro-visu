import type { Browser, Page } from "playwright-core";

import type { Logger } from "@/utils/logger";
import { applyCapture } from "@/pipeline/capture";
import { captureFramedVideo } from "@/recorder/frame-capture";
import type { ResolvedCaptureSettings } from "@/config/schema";
import { createSharedNetworkCache } from "@/recorder/network-cache";
import type { ResolvedScrollReelOptions } from "@/generators/scroll-reel/options";
import { applyPostNav, installNetworkHygiene, installPreNav } from "@/pipeline/clean-capture";
import { detectSectionOffsets, installScrollRuntime, measureNormalizedOffsets, measureTopInset, prepareScroll, seekFrame } from "@/generators/scroll-reel/scroll";
import {
  autoSectionSteps,
  autoSectionsBudgetMs,
  boomerangSpec,
  choreographyTimelineSpec,
  clamp01,
  defaultTimelineSpec,
  resolveTimeline,
  scrollTimelineTotalMs,
  straightLoopSpec,
  straightReturnFraction,
  DEFAULT_AUTO_HOLD_MS,
  DEFAULT_AUTO_MAX_SECTIONS,
  DEFAULT_AUTO_MIN_HEIGHT_FRACTION,
  DEFAULT_STEP_DURATION_MS,
  DEFAULT_STEP_HOLD_MS,
  HEADER_SEAM_BIAS_PX,
  type ResolvedChoreographyStep,
  type ResolvedTimeline,
  type TimelineSpec,
} from "@/generators/scroll-reel/timeline";

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
  /** Force a color scheme for this capture (emulated via prefers-color-scheme). */
  colorScheme?: "light" | "dark";
  capture: ResolvedCaptureSettings;
  tmpDir: string;
  logger: Logger;
  /** Fractional progress (0–1) as frames complete. */
  onProgress?: (fraction: number) => void;
  /** Cancels the capture mid-flight. */
  signal?: AbortSignal;
}

/**
 * Resolve the sticky-header top inset for landing sections/selectors below it. Order: an explicit
 * `height` wins; else measure an explicit `selector`; else the fixed/sticky heuristic. The measured
 * value is then biased UP by {@link HEADER_SEAM_BIAS_PX} so sections land a hair under the header
 * instead of exactly flush — otherwise a sub-pixel boundary seam of the previous section peeks out.
 * Returns 0 (no header, no bias) when nothing is detected.
 */
async function resolveHeaderInset(page: Page, override?: { selector?: string; height?: number }): Promise<number> {
  const measured = override?.height != null ? override.height : await page.evaluate(measureTopInset, { selector: override?.selector });
  return measured > 0 ? Math.max(0, measured - HEADER_SEAM_BIAS_PX) : 0;
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
  const steps = options.motion.choreography;
  const finalize = (spec: TimelineSpec): ResolvedTimeline => {
    let looped = spec;
    if (options.motion.loop === "boomerang") looped = boomerangSpec(spec);
    else if (options.motion.loop === "straight") {
      looped = straightLoopSpec(spec, straightReturnFraction(totalSeconds), options.motion.easing);
    }
    return resolveTimeline(looped, totalSeconds);
  };

  if (steps && steps.length > 0) {
    const selectors = steps.map((s) => s.to).filter((to): to is string => typeof to === "string" && !to.trim().endsWith("%"));
    const headerInsetPx = selectors.length > 0 ? await resolveHeaderInset(page) : 0;
    const measured = selectors.length > 0 ? await page.evaluate(measureNormalizedOffsets, { selectors, headerInsetPx }) : [];

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
        easing: s.easing ?? options.motion.easing,
      };
    });

    return finalize(
      choreographyTimelineSpec({
        startDelayMs: options.page.startDelayMs,
        endDwellMs: options.page.endDwellMs,
        steps: resolved,
      }),
    );
  }

  if (options.motion.autoSections) {
    const cfg = options.motion.autoSections === true ? {} : options.motion.autoSections;
    const headerInsetPx = await resolveHeaderInset(page, { selector: cfg.headerSelector, height: cfg.headerHeight });
    const offsets = await page.evaluate(detectSectionOffsets, {
      minHeightFraction: cfg.minHeightFraction ?? DEFAULT_AUTO_MIN_HEIGHT_FRACTION,
      selector: cfg.selector ?? null,
      maxSections: cfg.maxSections ?? DEFAULT_AUTO_MAX_SECTIONS,
      includeFooter: cfg.includeFooter ?? false,
      headerInsetPx,
    });
    const autoSteps = autoSectionSteps({
      offsets,
      budgetMs: autoSectionsBudgetMs(options.motion.autoSections),
      startDelayMs: options.page.startDelayMs,
      endDwellMs: options.page.endDwellMs,
      holdMs: cfg.holdMs ?? DEFAULT_AUTO_HOLD_MS,
      constantVelocity: cfg.constantVelocity ?? true,
      easing: options.motion.easing,
    });
    if (autoSteps.length > 0) {
      logger.debug(`autoSections: ${autoSteps.length} section(s) detected`);
      return finalize(
        choreographyTimelineSpec({
          startDelayMs: options.page.startDelayMs,
          endDwellMs: options.page.endDwellMs,
          steps: autoSteps,
        }),
      );
    }
    logger.warn("autoSections: no scrollable sections detected — using a default sweep");
  }

  return finalize(
    defaultTimelineSpec({
      startDelayMs: options.page.startDelayMs,
      durationMs: options.motion.durationMs,
      endDwellMs: options.page.endDwellMs,
      easing: options.motion.easing,
    }),
  );
}

/**
 * Deterministic, frame-stepped recording of a real site. Each worker navigates + warms the page once
 * (reusing {@link prepareScroll} to trigger lazy content, fonts and image decode), applies clean-capture
 * suppression, builds the scroll timeline (resolving any choreography selectors against the page), then
 * for every frame sets the scroll position via {@link seekFrame} (one evaluate: seek + settle),
 * and screenshots — piped straight into ffmpeg by the shared {@link captureFramedVideo} harness. No
 * realtime recording, no dropped/jittered frames, no navigation lead to trim.
 */
export async function captureScrollFrames(a: ScrollFramesArgs): Promise<void> {
  const { options } = a;
  const totalSeconds = scrollTimelineTotalMs({
      startDelayMs: options.page.startDelayMs,
      durationMs: options.motion.durationMs,
      endDwellMs: options.page.endDwellMs,
      choreography: options.motion.choreography,
      autoSections: options.motion.autoSections,
    }) / 1000;
  const netCache = a.workers > 1 ? createSharedNetworkCache({ logger: a.logger }) : null;
  await captureFramedVideo<ResolvedTimeline>({
    browser: a.browser,
    width: options.output.width,
    height: options.output.height,
    deviceScaleFactor: options.output.deviceScaleFactor,
    fps: options.output.fps,
    durationSeconds: totalSeconds,
    crf: options.output.crf,
    outPath: a.outPath,
    preset: a.preset,
    frameFormat: a.frameFormat,
    jpegQuality: a.jpegQuality,
    workers: a.workers,
    tmpDir: a.tmpDir,
    logger: a.logger,
    onProgress: a.onProgress,
    signal: a.signal,
    prepare: async (page, { logger }) => {
      if (a.colorScheme) await page.emulateMedia({ colorScheme: a.colorScheme });
      await applyCapture(page.context(), a.capture, a.url);
      if (netCache) await netCache.install(page);
      await installNetworkHygiene(page, a.capture);
      await installPreNav(page, a.capture, { themeClass: options.variants.themeClass });
      await page.addInitScript(installScrollRuntime);
      logger.debug(`navigating to ${a.url} (waitUntil=${options.page.waitUntil})`);
      await page.goto(a.url, { waitUntil: options.page.waitUntil });
      if (options.page.waitForSelector) {
        logger.debug(`waiting for selector ${options.page.waitForSelector}`);
        await page.waitForSelector(options.page.waitForSelector, { state: "visible" });
      }
      await applyPostNav(page, a.capture, logger, { themeClass: options.variants.themeClass });
      await page.evaluate(prepareScroll, { settleMs: PREWARM_SETTLE_MS });
      return buildScrollTimeline(page, options, totalSeconds, logger);
    },
    seekToFrame: async (page, t, timeline) => {
      await page.evaluate(seekFrame, { normalizedY: timeline.scrollAt(t), settleMaxMs: a.settlePerFrame ? a.settleMaxMs : undefined });
    },
  });
}
