import type { Browser, Page } from "playwright-core";
import { captureFramedVideo } from "@/media/frame-capture";
import {
  detectSectionOffsets,
  measureNormalizedOffsets,
  prepareScroll,
  seekScrollTo,
  settleInView,
} from "@/generators/scroll-reel/scroll";
import {
  applyPostNav,
  installNetworkHygiene,
  installPreNav,
} from "@/generators/scroll-reel/clean-capture";
import {
  annotationStateAt,
  installAnnotationRuntime,
} from "@/generators/scroll-reel/annotations";
import {
  autoSectionSteps,
  autoSectionsBudgetMs,
  boomerangSpec,
  choreographyTimelineSpec,
  clamp01,
  defaultTimelineSpec,
  foldProgress,
  kenBurnsScaleAt,
  resolveTimeline,
  scrollTimelineTotalMs,
  DEFAULT_AUTO_HOLD_MS,
  DEFAULT_AUTO_MAX_SECTIONS,
  DEFAULT_AUTO_MIN_HEIGHT_FRACTION,
  DEFAULT_STEP_DURATION_MS,
  DEFAULT_STEP_HOLD_MS,
  type ResolvedChoreographyStep,
  type ResolvedTimeline,
  type TimelineSpec,
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
  /** Force a color scheme for this capture (emulated via prefers-color-scheme). */
  colorScheme?: "light" | "dark";
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
  // Apply the loop transform (boomerang mirrors the spec) before binding to wall-clock time.
  const finalize = (spec: TimelineSpec): ResolvedTimeline =>
    resolveTimeline(options.loop === "boomerang" ? boomerangSpec(spec) : spec, totalSeconds);

  // 1. Explicit choreography wins: resolve selector targets in one in-page pass (numbers/% in Node).
  if (steps && steps.length > 0) {
    const selectors = steps
      .map((s) => s.to)
      .filter((to): to is string => typeof to === "string" && !to.trim().endsWith("%"));
    const measured =
      selectors.length > 0 ? await page.evaluate(measureNormalizedOffsets, { selectors }) : [];

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

    return finalize(
      choreographyTimelineSpec({
        startDelayMs: options.startDelayMs,
        endDwellMs: options.endDwellMs,
        steps: resolved,
      }),
    );
  }

  // 2. Auto-sections: detect the page's sections and pan/hold through them within a fixed budget.
  if (options.autoSections) {
    const cfg = options.autoSections === true ? {} : options.autoSections;
    const offsets = await page.evaluate(detectSectionOffsets, {
      minHeightFraction: cfg.minHeightFraction ?? DEFAULT_AUTO_MIN_HEIGHT_FRACTION,
      selector: cfg.selector ?? null,
      maxSections: cfg.maxSections ?? DEFAULT_AUTO_MAX_SECTIONS,
    });
    const autoSteps = autoSectionSteps({
      offsets,
      budgetMs: autoSectionsBudgetMs(options.autoSections),
      startDelayMs: options.startDelayMs,
      endDwellMs: options.endDwellMs,
      holdMs: cfg.holdMs ?? DEFAULT_AUTO_HOLD_MS,
      constantVelocity: cfg.constantVelocity ?? true,
      easing: options.easing,
    });
    if (autoSteps.length > 0) {
      logger.debug(`autoSections: ${autoSteps.length} section(s) detected`);
      return finalize(
        choreographyTimelineSpec({
          startDelayMs: options.startDelayMs,
          endDwellMs: options.endDwellMs,
          steps: autoSteps,
        }),
      );
    }
    logger.warn("autoSections: no scrollable sections detected — using a default sweep");
  }

  // 3. Default: a single eased top→bottom sweep.
  return finalize(
    defaultTimelineSpec({
      startDelayMs: options.startDelayMs,
      durationMs: options.duration,
      endDwellMs: options.endDwellMs,
      easing: options.easing,
    }),
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
      // Force the color scheme + block tracker requests before navigation so load-time media queries
      // and the network match the intended capture.
      if (a.colorScheme) await page.emulateMedia({ colorScheme: a.colorScheme });
      await installNetworkHygiene(page, options);
      // Pre-navigation hooks (e.g. freeze the clock, theme class) must be installed before page scripts.
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
      if (options.annotations && options.annotations.length > 0) {
        await page.evaluate(installAnnotationRuntime, { color: "#7c9cff" });
      }
      // Resolve the timeline against the (now stable) page; deterministic across workers.
      return buildScrollTimeline(page, options, totalSeconds, logger);
    },
    seekToFrame: async (page, t, timeline) => {
      const kb = options.kenBurns;
      let scale: number | undefined;
      let originX: number | undefined;
      let originY: number | undefined;
      if (kb) {
        const p = totalSeconds > 0 ? t / totalSeconds : 1;
        // Fold the zoom progress under a boomerang loop so the zoom returns to its start (seamless).
        const zp = options.loop === "boomerang" ? foldProgress(p) : p;
        scale = kenBurnsScaleAt(zp, {
          scaleFrom: kb.scaleFrom ?? 1,
          scaleTo: kb.scaleTo ?? 1.08,
          easing: kb.easing ?? options.easing,
        });
        originX = kb.originX ?? 0.5;
        originY = kb.originY ?? 0.5;
      }
      await page.evaluate(seekScrollTo, {
        normalizedY: timeline.scrollAt(t),
        scale,
        originX,
        originY,
      });
      if (options.annotations && options.annotations.length > 0) {
        const state = annotationStateAt(options.annotations, t * 1000, totalSeconds * 1000);
        await page.evaluate(
          (s) =>
            (globalThis as { __scAnno?: { update(x: unknown): Promise<void> } }).__scAnno?.update(s),
          state,
        );
      }
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
