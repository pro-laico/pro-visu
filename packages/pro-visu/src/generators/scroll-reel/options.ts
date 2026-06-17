import { z } from "zod";

const easingSchema = z.enum([
  "linear",
  "easeInOutCubic",
  "easeInOutQuad",
  "easeOutCubic",
  "easeInOutSine",
  "easeInOutExpo",
  "easeOutQuint",
]);
export type Easing = z.infer<typeof easingSchema>;

/** One choreographed scroll step (see `choreography` below). */
const choreographyStepSchema = z
  .object({
    /** Target: a 0..1 number, an "NN%" string, or a CSS selector to bring into view. */
    to: z
      .union([z.number(), z.string()])
      .describe('Target: a 0..1 number, an "NN%" string, or a CSS selector to bring into view.'),
    /** Travel time to this target (ms). Default 1200. */
    durationMs: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Travel time to this target (ms). Default 1200."),
    /** Hold time at this target after arriving (ms). Default 800. */
    holdMs: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Hold time at this target after arriving (ms). Default 800."),
    easing: easingSchema
      .optional()
      .describe('Easing for the travel to this target. Default "easeInOutCubic".'),
  })
  .strict();

/** One step of a scripted interaction (see `actions` below). */
const interactionActionSchema = z
  .object({
    do: z
      .enum(["move", "click", "hover", "type", "scrollTo", "wait"])
      .describe("What this step does."),
    /** Target element for move/click/hover/type. */
    selector: z.string().optional().describe("Target element for move/click/hover/type."),
    /** Viewport-relative target for `move` without a selector (0..1). */
    x: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Viewport-relative X target for a selector-less `move` (0..1)."),
    y: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Viewport-relative Y target for a selector-less `move` (0..1)."),
    /** Text to type (for `type`). */
    text: z.string().optional().describe("Text to type (for `type`)."),
    /** Scroll target for `scrollTo`: a 0..1 number, an "NN%" string, or a CSS selector. */
    to: z
      .union([z.number(), z.string()])
      .optional()
      .describe('Scroll target for `scrollTo`: a 0..1 number, an "NN%" string, or a CSS selector.'),
    /** Cursor travel / scroll animation time (ms). Default 700. */
    durationMs: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Cursor travel / scroll animation time (ms). Default 700."),
    /** Pause after the step (ms). Default 600. */
    holdMs: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Pause after the step (ms). Default 600."),
  })
  .strict();

/** Tuning for auto-section choreography (see `autoSections` below). */
const autoSectionsSchema = z
  .object({
    /** Min element height (as a fraction of the viewport) to count as a section. Default 0.5. */
    minHeightFraction: z
      .number()
      .positive()
      .max(2)
      .optional()
      .describe(
        "Min element height (as a fraction of the viewport) to count as a section. Default 0.5.",
      ),
    /** Explicit section selector; overrides the heuristic. */
    selector: z
      .string()
      .optional()
      .describe("Explicit section selector; overrides the heuristic. Omit to auto-detect."),
    /** Hold at each detected section (ms). Default 700. */
    holdMs: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Hold at each detected section (ms). Default 700."),
    /** Total clip length (ms) split across detected sections. Default 12000. */
    durationMs: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Total clip length (ms) split across detected sections. Default 12000."),
    /** Cap on the number of sections. Default 8. */
    maxSections: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Cap on the number of sections. Default 8."),
    /** Distribute travel time by distance for uniform scroll speed. Default true. */
    constantVelocity: z
      .boolean()
      .optional()
      .describe("Distribute travel time by distance for uniform scroll speed. Default true."),
  })
  .strict();

/** An intro/outro card (see `intro` / `outro`). */
const cardSchema = z
  .object({
    title: z.string().optional().describe("Card title (large). Omit for none."),
    subtitle: z
      .string()
      .optional()
      .describe("Card subtitle (small, under the title). Omit for none."),
    background: z.string().optional().describe("Card background color. Default black."),
    color: z.string().optional().describe("Card text color. Default white."),
    durationMs: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("How long the card holds (ms). Default 1500."),
    fadeMs: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Fade in/out length (ms). Default 400."),
  })
  .strict();

/** A timed on-screen annotation (see `annotations`). */
const annotationSchema = z
  .object({
    /** Caption text shown while active. */
    text: z
      .string()
      .optional()
      .describe("Caption text shown while active. Omit for a ring/spotlight with no caption."),
    /** Selector to outline with a highlight ring. */
    ring: z.string().optional().describe("Selector to outline with a highlight ring."),
    /** Selector to spotlight (everything else dimmed). */
    spotlight: z.string().optional().describe("Selector to spotlight (everything else dimmed)."),
    /** When it appears (clip time, ms). Default 0. */
    atMs: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("When it appears (clip time, ms). Default 0."),
    /** When it disappears (clip time, ms). Default = end. */
    untilMs: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("When it disappears (clip time, ms). Default = end of clip."),
    /** Caption placement. Default "bottom". */
    position: z
      .enum(["top", "bottom", "center"])
      .optional()
      .describe('Caption placement. Default "bottom".'),
  })
  .strict();

export const scrollReelOptionsSchema = z
  .object({
    /** Viewport + output width in CSS pixels. */
    width: z
      .number()
      .int()
      .positive()
      .default(1280)
      .describe("Viewport + output width in CSS px. Default 1280."),
    /** Viewport + output height in CSS pixels. */
    height: z
      .number()
      .int()
      .positive()
      .default(800)
      .describe("Viewport + output height in CSS px. Default 800."),
    /** Render scale (2 = retina-crisp capture, downscaled into the video). */
    deviceScaleFactor: z
      .number()
      .positive()
      .max(4)
      .default(2)
      .describe("Render scale (2 = retina-crisp capture, downscaled into the video). Default 2."),
    /** Output frames per second (re-encoded from the recording). */
    fps: z
      .number()
      .int()
      .positive()
      .max(120)
      .default(30)
      .describe("Output frames per second (re-encoded from the recording). Default 30."),
    /** Time to scroll from top to bottom (ms). */
    duration: z
      .number()
      .int()
      .positive()
      .default(6000)
      .describe("Time to scroll from top to bottom (ms). Default 6000."),
    easing: easingSchema
      .default("easeInOutCubic")
      .describe('Easing for the default top→bottom scroll. Default "easeInOutCubic".'),
    /** Dwell at the top before scrolling (ms). */
    startDelayMs: z
      .number()
      .int()
      .nonnegative()
      .default(500)
      .describe("Dwell at the top before scrolling (ms). Default 500."),
    /** Dwell at the bottom after scrolling (ms). */
    endDwellMs: z
      .number()
      .int()
      .nonnegative()
      .default(800)
      .describe("Dwell at the bottom after scrolling (ms). Default 800."),
    waitUntil: z
      .enum(["load", "domcontentloaded", "networkidle", "commit"])
      .default("networkidle")
      .describe('Page-load milestone to wait for before recording. Default "networkidle".'),
    /** Optional element to wait for before recording (e.g. a hero section). */
    waitForSelector: z
      .string()
      .optional()
      .describe("Optional element to wait for before recording (e.g. a hero section). Omit to skip."),
    /** x264 quality, 0–51 (lower = better/larger). */
    crf: z
      .number()
      .int()
      .min(0)
      .max(51)
      .default(18)
      .describe("x264 quality, 0–51 (lower = better quality / larger file). Default 18."),
    /**
     * Capture strategy. "frames" (default) steps a virtual clock, sets the scroll position per frame and
     * screenshots — frame-accurate, crisp (supersampled) and reproducible. "realtime" records the live
     * browser session; use it only when the page's hero relies on time-based (not scroll-driven)
     * animation or autoplay video that should play during the capture.
     */
    capture: z
      .enum(["frames", "realtime"])
      .default("frames")
      .describe(
        '"frames" (default) steps a virtual clock per frame — frame-accurate, crisp, reproducible; "realtime" records the live session for time-based hero animation or autoplay video.',
      ),
    /** Parallel render workers for "frames" (each its own browser context). Omit to auto-pick by cores. */
    workers: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Parallel render workers for "frames" (each its own browser context). Omit to auto-pick by cores.',
      ),
    /** Intermediate frame format for "frames"; "png" is lossless (slower), "jpeg" (default) is faster. */
    frameFormat: z
      .enum(["jpeg", "png"])
      .default("jpeg")
      .describe(
        'Intermediate frame format for "frames". "jpeg" (default) is faster; "png" is lossless.',
      ),

    /**
     * Choreographed scroll: an ordered list of steps instead of one top→bottom sweep. Each step scrolls
     * to a target (a 0..1 number, an "NN%" string, or a CSS selector to bring into view), then holds —
     * the "pause on each section" look. "frames" capture only (ignored by "realtime"). Omit for the
     * default single eased sweep. Clip length becomes startDelay + Σ(step travel + hold) + endDwell.
     */
    choreography: z
      .array(choreographyStepSchema)
      .optional()
      .describe(
        'Choreographed scroll: an ordered list of steps instead of one top→bottom sweep ("frames" only). Omit for the default single eased sweep.',
      ),

    /**
     * Auto-choreograph: detect the page's sections and pan/hold through them automatically (no manual
     * selectors). `true` for defaults, or an object to tune. The clip is a fixed budget (`durationMs`,
     * default 12000) split across detected sections. "frames" capture only; ignored if `choreography`
     * is set.
     */
    autoSections: z
      .union([z.boolean(), autoSectionsSchema])
      .optional()
      .describe(
        'Auto-choreograph: detect sections and pan/hold through them ("frames" only). `true` for defaults, or an object to tune. Ignored if `choreography` is set.',
      ),

    /** Loop style. "boomerang" plays the scroll forward then back within the clip for a seamless loop. */
    loop: z
      .enum(["none", "boomerang"])
      .default("none")
      .describe(
        'Loop style. "boomerang" plays the scroll forward then back for a seamless loop. Default "none".',
      ),

    /**
     * Ken Burns: a slow zoom over the clip ("frames" only). Scales the page toward an origin each frame
     * (folds automatically under a boomerang loop to stay seamless). May affect position:fixed elements —
     * pair with clean-capture if needed.
     */
    kenBurns: z
      .object({
        /** Start scale (1 = no zoom). Default 1. */
        scaleFrom: z
          .number()
          .positive()
          .optional()
          .describe("Start scale (1 = no zoom). Default 1."),
        /** End scale. Default 1.08. */
        scaleTo: z.number().positive().optional().describe("End scale. Default 1.08."),
        easing: easingSchema
          .optional()
          .describe('Easing for the zoom ramp. Default "easeInOutCubic".'),
        /** Zoom origin X within the viewport (0 = left, 1 = right). Default 0.5. */
        originX: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Zoom origin X within the viewport (0 = left, 1 = right). Default 0.5."),
        /** Zoom origin Y within the viewport (0 = top, 1 = bottom). Default 0.5. */
        originY: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Zoom origin Y within the viewport (0 = top, 1 = bottom). Default 0.5."),
      })
      .strict()
      .optional()
      .describe('Ken Burns slow zoom over the clip ("frames" only). Omit for no zoom.'),

    // --- interaction (scripted realtime "tour" with a synthetic cursor) ---
    /**
     * Drive a scripted interaction instead of an auto-scroll: a sequence of steps (move / click /
     * hover / type / scrollTo / wait) performed live with a visible cursor. Setting this records in
     * REALTIME (interactions and their animations are inherently time-based) and emits a single asset
     * (variants / aspect / extra outputs are skipped).
     */
    actions: z
      .array(interactionActionSchema)
      .optional()
      .describe(
        "Drive a scripted interaction instead of an auto-scroll (move/click/hover/type/scrollTo/wait). Records in REALTIME and emits a single asset (variants/aspect/extra outputs skipped).",
      ),
    /** The synthetic cursor shown during an interaction. */
    cursor: z
      .object({
        show: z
          .boolean()
          .optional()
          .describe("Show the cursor. Default true (when `actions` is set)."),
        size: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Cursor size (px). Default 22."),
        color: z.string().optional().describe("Cursor color. Default white-with-shadow."),
      })
      .strict()
      .optional()
      .describe("The synthetic cursor shown during an interaction. Omit for the default cursor."),

    /**
     * Element-focused clip: scroll one component into view, optionally trigger it (`actions`), hold,
     * and crop the output to its box (+padding). Realtime; emits a single asset (variants / aspect /
     * outputs / cards are skipped).
     */
    focus: z
      .object({
        selector: z
          .string()
          .describe("Selector of the element to scroll into view and crop to."),
        /** Padding (px) around the element when cropping. Default 24. */
        padding: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Padding (px) around the element when cropping. Default 24."),
        /** Optional steps to trigger the component (e.g. open a dropdown) before holding. */
        actions: z
          .array(interactionActionSchema)
          .optional()
          .describe(
            "Optional steps to trigger the component (e.g. open a dropdown) before holding.",
          ),
        /** Time to dwell on the element after positioning/triggering (ms). Default 2000. */
        holdMs: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Time to dwell on the element after positioning / triggering (ms). Default 2000."),
      })
      .strict()
      .optional()
      .describe(
        "Element-focused clip: scroll one component into view, optionally trigger it, hold, and crop the output to its box. Realtime; emits a single asset (variants/aspect/outputs/cards skipped).",
      ),

    // --- variants (each emitted as its own asset; "frames" path) ---
    /** Force a color scheme. "both" emits a light AND a dark asset (<name>-light / <name>-dark). */
    colorScheme: z
      .enum(["light", "dark", "both"])
      .optional()
      .describe(
        'Force a color scheme. "both" emits a light AND a dark asset (<name>-light / <name>-dark). Omit to leave as-is.',
      ),
    /** Add this class to <html> before capture (e.g. to trigger a CSS-class dark theme). */
    themeClass: z
      .string()
      .optional()
      .describe(
        "Add this class to <html> before capture (e.g. to trigger a CSS-class dark theme). Omit for none.",
      ),
    /** Capture the same reel at multiple viewports; each emits an asset (<name>-<viewport name>). */
    viewports: z
      .array(
        z
          .object({
            name: z
              .string()
              .describe("Name appended to the asset (<name>-<viewport name>)."),
            width: z.number().int().positive().describe("Viewport width in CSS px."),
            height: z.number().int().positive().describe("Viewport height in CSS px."),
            deviceScaleFactor: z
              .number()
              .positive()
              .max(4)
              .optional()
              .describe(
                "Override the generator-level `deviceScaleFactor` for this viewport. Omit to inherit it.",
              ),
          })
          .strict(),
      )
      .optional()
      .describe(
        "Also capture the reel at these viewports; each emits an asset (<name>-<viewport name>).",
      ),

    // --- multi-page tour ("frames" path) ---
    /**
     * Capture several routes and concatenate them into one reel. Each entry is a URL, or an object with
     * per-route `choreography` / `autoSections` / `durationMs`. Frame-stepped per route; emits a single
     * asset (variants are skipped; aspect/outputs apply to the final tour).
     */
    routes: z
      .array(
        z.union([
          z.string(),
          z
            .object({
              url: z
                .string()
                .describe('Route URL (absolute, or a "/path" against the managed server).'),
              choreography: z
                .array(choreographyStepSchema)
                .optional()
                .describe("Per-route choreographed scroll (overrides the tour default)."),
              autoSections: z
                .union([z.boolean(), autoSectionsSchema])
                .optional()
                .describe("Per-route auto-section choreography."),
              durationMs: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("This route's slice of the tour (ms)."),
            })
            .strict(),
        ]),
      )
      .optional()
      .describe(
        'Capture several routes and concatenate them into one reel ("frames" path). Emits a single asset (variants skipped; aspect/outputs apply to the final tour).',
      ),

    // --- clean capture (suppress real-site noise; applied on the "frames" path) ---
    /** Hide elements matching these CSS selectors before capture (cookie banners, chat widgets, …). */
    hideSelectors: z
      .array(z.string())
      .default([])
      .describe(
        "Hide elements matching these CSS selectors before capture (cookie banners, chat widgets, …). Default none.",
      ),
    /** Extra CSS injected before capture (e.g. a brand backdrop, or hiding a sticky header). */
    injectCss: z
      .string()
      .optional()
      .describe(
        "Extra CSS injected before capture (e.g. a brand backdrop, or hiding a sticky header). Omit for none.",
      ),
    /** Click these selectors once after load to dismiss overlays (consent dialogs); best-effort. */
    clickSelectors: z
      .array(z.string())
      .default([])
      .describe(
        "Click these selectors once after load to dismiss overlays (consent dialogs); best-effort. Default none.",
      ),
    /** Hide scrollbars so they don't appear in the capture. */
    hideScrollbars: z
      .boolean()
      .default(true)
      .describe("Hide scrollbars so they don't appear in the capture. Default true."),
    /** Pause CSS animations/transitions for fully static, deterministic frames. */
    pauseAnimations: z
      .boolean()
      .default(false)
      .describe("Pause CSS animations/transitions for fully static, deterministic frames. Default false."),
    /** Freeze Date.now / performance.now / Math.random (seeded) so time/random content is stable. */
    freezeClock: z
      .boolean()
      .default(false)
      .describe(
        "Freeze Date.now / performance.now / Math.random (seeded) so time/random content is stable. Default false.",
      ),
    /** Abort common analytics/ads/session-replay requests during capture (cleaner, faster). */
    blockTrackers: z
      .boolean()
      .default(true)
      .describe(
        "Abort common analytics/ads/session-replay requests during capture (cleaner, faster). Default true.",
      ),
    /** Extra hostname substrings to block during capture. */
    blockHosts: z
      .array(z.string())
      .default([])
      .describe("Extra hostname substrings to block during capture. Default none."),
    /** Playwright resource types to block (e.g. "media", "font", "image"). */
    blockResourceTypes: z
      .array(z.string())
      .default([])
      .describe('Playwright resource types to block (e.g. "media", "font", "image"). Default none.'),

    // --- per-frame settling ("frames" path) ---
    /** Wait for fonts + in-view images before each frame's screenshot. Defaults on (off in draft). */
    settlePerFrame: z
      .boolean()
      .optional()
      .describe(
        "Wait for fonts + in-view images before each frame's screenshot (\"frames\"). Defaults on (off in draft).",
      ),
    /** Max time (ms) to wait per frame for settling before screenshotting anyway. */
    settleMaxMs: z
      .number()
      .int()
      .nonnegative()
      .default(250)
      .describe(
        "Max time (ms) to wait per frame for settling before screenshotting anyway. Default 250.",
      ),

    // --- output formats & reframing ("frames" path) ---
    /** Reframe the output to a target aspect: a preset ("16:9"|"9:16"|"1:1") or explicit {width,height}. */
    aspect: z
      .union([
        z.enum(["16:9", "9:16", "1:1"]),
        z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).strict(),
      ])
      .optional()
      .describe(
        'Reframe the output to a target aspect: a preset ("16:9"|"9:16"|"1:1") or explicit {width,height}. Omit to keep the capture aspect.',
      ),
    /** How to fit the capture into the aspect: "cover" (scale + center-crop) or "contain" (scale + pad). */
    fit: z
      .enum(["cover", "contain"])
      .default("cover")
      .describe(
        'How to fit the capture into `aspect`: "cover" (scale + center-crop) or "contain" (scale + pad). Default "cover".',
      ),
    /** Pad color used by "contain". */
    padColor: z
      .string()
      .default("#0b0b0f")
      .describe('Pad color used by "contain". Default "#0b0b0f".'),
    /** Files to emit per variant; each becomes its own asset. */
    outputs: z
      .array(z.enum(["mp4", "gif", "webp", "poster"]))
      .default(["mp4"])
      .describe('Files to emit per variant; each becomes its own asset. Default ["mp4"].'),
    /** GIF / animated-WebP frame rate. Defaults to min(fps, 15). */
    gifFps: z
      .number()
      .int()
      .positive()
      .max(50)
      .optional()
      .describe("GIF / animated-WebP frame rate. Defaults to min(fps, 15)."),
    /** Intro card shown before the reel (fades from black). Applies to frames / route tours. */
    intro: cardSchema
      .optional()
      .describe(
        "Intro card shown before the reel (fades from black). Applies to frames / route tours. Omit for none.",
      ),
    /** Outro / end card shown after the reel. */
    outro: cardSchema.optional().describe("Outro / end card shown after the reel. Omit for none."),
    /** Timed on-screen annotations (caption text, a highlight ring, or a spotlight on a selector). */
    annotations: z
      .array(annotationSchema)
      .optional()
      .describe(
        "Timed on-screen annotations (caption text, a highlight ring, or a spotlight on a selector).",
      ),

    /** Output filename; defaults to "<slug(asset name)>.mp4". */
    fileName: z
      .string()
      .optional()
      .describe('Output filename; defaults to "<slug(asset name)>.mp4".'),
  })
  .strict();

// ---------------------------------------------------------------------------
// Author-facing input types (editor autocomplete + hover docs). JSDoc on the
// zod schema above does NOT surface on hover through `z.input`, so the docs
// live on these hand-written interfaces, kept in sync with the schema by the
// Exact<> guard at the bottom — a drift is a compile error.
// ---------------------------------------------------------------------------

/** One choreographed scroll step. */
export interface ChoreographyStepInput {
  /** Target: a 0..1 number, an "NN%" string, or a CSS selector to bring into view. */
  to: number | string;
  /** Travel time to this target (ms). Default 1200. */
  durationMs?: number;
  /** Hold time at this target after arriving (ms). Default 800. */
  holdMs?: number;
  /** Easing for the travel to this target. Default "easeInOutCubic". */
  easing?: Easing;
}

/** One step of a scripted interaction (`actions` / `focus.actions`). */
export interface InteractionActionInput {
  /** What this step does. */
  do: "move" | "click" | "hover" | "type" | "scrollTo" | "wait";
  /** Target element for move/click/hover/type. */
  selector?: string;
  /** Viewport-relative X target for a selector-less `move` (0..1). */
  x?: number;
  /** Viewport-relative Y target for a selector-less `move` (0..1). */
  y?: number;
  /** Text to type (for `type`). */
  text?: string;
  /** Scroll target for `scrollTo`: a 0..1 number, an "NN%" string, or a CSS selector. */
  to?: number | string;
  /** Cursor travel / scroll animation time (ms). Default 700. */
  durationMs?: number;
  /** Pause after the step (ms). Default 600. */
  holdMs?: number;
}

/** Tuning for auto-section choreography (`autoSections`). */
export interface AutoSectionsInput {
  /** Min element height (as a fraction of the viewport) to count as a section. Default 0.5. */
  minHeightFraction?: number;
  /** Explicit section selector; overrides the heuristic. Omit to auto-detect. */
  selector?: string;
  /** Hold at each detected section (ms). Default 700. */
  holdMs?: number;
  /** Total clip length (ms) split across detected sections. Default 12000. */
  durationMs?: number;
  /** Cap on the number of sections. Default 8. */
  maxSections?: number;
  /** Distribute travel time by distance for uniform scroll speed. Default true. */
  constantVelocity?: boolean;
}

/** An intro / outro card (`intro` / `outro`). */
export interface CardInput {
  /** Card title (large). Omit for none. */
  title?: string;
  /** Card subtitle (small, under the title). Omit for none. */
  subtitle?: string;
  /** Card background color. Default black. */
  background?: string;
  /** Card text color. Default white. */
  color?: string;
  /** How long the card holds (ms). Default 1500. */
  durationMs?: number;
  /** Fade in/out length (ms). Default 400. */
  fadeMs?: number;
}

/** A timed on-screen annotation (`annotations`). */
export interface AnnotationInput {
  /** Caption text shown while active. Omit for a ring/spotlight with no caption. */
  text?: string;
  /** Selector to outline with a highlight ring. */
  ring?: string;
  /** Selector to spotlight (everything else dimmed). */
  spotlight?: string;
  /** When it appears (clip time, ms). Default 0. */
  atMs?: number;
  /** When it disappears (clip time, ms). Default = end of clip. */
  untilMs?: number;
  /** Caption placement. Default "bottom". */
  position?: "top" | "bottom" | "center";
}

/** Ken Burns slow-zoom config ("frames" capture only). */
export interface KenBurnsInput {
  /** Start scale (1 = no zoom). Default 1. */
  scaleFrom?: number;
  /** End scale. Default 1.08. */
  scaleTo?: number;
  /** Easing for the zoom ramp. Default "easeInOutCubic". */
  easing?: Easing;
  /** Zoom origin X within the viewport (0 = left, 1 = right). Default 0.5. */
  originX?: number;
  /** Zoom origin Y within the viewport (0 = top, 1 = bottom). Default 0.5. */
  originY?: number;
}

/** The synthetic cursor shown during an interaction. */
export interface CursorInput {
  /** Show the cursor. Default true (when `actions` is set). */
  show?: boolean;
  /** Cursor size (px). Default 22. */
  size?: number;
  /** Cursor color. Default white-with-shadow. */
  color?: string;
}

/** Element-focused clip config (`focus`). */
export interface FocusInput {
  /** Selector of the element to scroll into view and crop to. */
  selector: string;
  /** Padding (px) around the element when cropping. Default 24. */
  padding?: number;
  /** Optional steps to trigger the component (e.g. open a dropdown) before holding. */
  actions?: InteractionActionInput[];
  /** Time to dwell on the element after positioning / triggering (ms). Default 2000. */
  holdMs?: number;
}

/** One extra viewport to also capture the reel at (`viewports`). */
export interface ViewportInput {
  /** Name appended to the asset (<name>-<viewport name>). */
  name: string;
  /** Viewport width in CSS px. */
  width: number;
  /** Viewport height in CSS px. */
  height: number;
  /** Override the generator-level `deviceScaleFactor` for this viewport. Omit to inherit it. */
  deviceScaleFactor?: number;
}

/** One route in a multi-page tour: a URL string, or an object with per-route choreography. */
export type RouteInput =
  | string
  | {
      /** Route URL (absolute, or a "/path" against the managed server). */
      url: string;
      /** Per-route choreographed scroll (overrides the tour default). */
      choreography?: ChoreographyStepInput[];
      /** Per-route auto-section choreography. */
      autoSections?: boolean | AutoSectionsInput;
      /** This route's slice of the tour (ms). */
      durationMs?: number;
    };

/** Target output aspect: a preset, or an explicit pixel box. */
export type AspectInput = "16:9" | "9:16" | "1:1" | { width: number; height: number };

/**
 * Author-facing options for the `scroll-reel` generator — a video of a page. By default it eases a
 * single top→bottom scroll; the options below switch it into choreographed / auto-section / focus /
 * interaction / multi-route modes, add cards & annotations, clean up the page, and reframe / re-encode
 * the output. Everything is optional, with the defaults noted below.
 */
export interface ScrollReelOptionsInput {
  /** Viewport + output width in CSS px. Default 1280. */
  width?: number;
  /** Viewport + output height in CSS px. Default 800. */
  height?: number;
  /** Render scale (2 = retina-crisp capture, downscaled into the video). Default 2. */
  deviceScaleFactor?: number;
  /** Output frames per second (re-encoded from the recording). Default 30. */
  fps?: number;
  /** Time to scroll from top to bottom (ms). Default 6000. */
  duration?: number;
  /** Easing for the default top→bottom scroll. Default "easeInOutCubic". */
  easing?: Easing;
  /** Dwell at the top before scrolling (ms). Default 500. */
  startDelayMs?: number;
  /** Dwell at the bottom after scrolling (ms). Default 800. */
  endDwellMs?: number;
  /** Page-load milestone to wait for before recording. Default "networkidle". */
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  /** Optional element to wait for before recording (e.g. a hero section). Omit to skip. */
  waitForSelector?: string;
  /** x264 quality, 0–51 (lower = better quality / larger file). Default 18. */
  crf?: number;
  /**
   * Capture strategy. "frames" (default) steps a virtual clock per frame — frame-accurate, crisp,
   * reproducible. "realtime" records the live session; use it only for time-based hero animation or
   * autoplay video. Default "frames".
   */
  capture?: "frames" | "realtime";
  /** Parallel render workers for "frames" (each its own browser context). Omit to auto-pick by cores. */
  workers?: number;
  /** Intermediate frame format for "frames". "jpeg" (default) is faster; "png" is lossless. Default "jpeg". */
  frameFormat?: "jpeg" | "png";
  /**
   * Choreographed scroll: an ordered list of steps instead of one top→bottom sweep ("frames" only).
   * Omit for the default single eased sweep.
   */
  choreography?: ChoreographyStepInput[];
  /**
   * Auto-choreograph: detect the page's sections and pan/hold through them ("frames" only). `true`
   * for defaults, or an object to tune. Ignored if `choreography` is set. Omit to disable.
   */
  autoSections?: boolean | AutoSectionsInput;
  /** Loop style. "boomerang" plays the scroll forward then back for a seamless loop. Default "none". */
  loop?: "none" | "boomerang";
  /** Ken Burns slow zoom over the clip ("frames" only). Omit for no zoom. */
  kenBurns?: KenBurnsInput;
  /**
   * Drive a scripted interaction instead of an auto-scroll (move/click/hover/type/scrollTo/wait).
   * Setting this records in REALTIME and emits a single asset (variants/aspect/extra outputs skipped).
   */
  actions?: InteractionActionInput[];
  /** The synthetic cursor shown during an interaction. Omit for the default cursor. */
  cursor?: CursorInput;
  /**
   * Element-focused clip: scroll one component into view, optionally trigger it, hold, and crop the
   * output to its box. Realtime; emits a single asset (variants/aspect/outputs/cards skipped).
   */
  focus?: FocusInput;
  /** Force a color scheme. "both" emits a light AND a dark asset (<name>-light / <name>-dark). Omit to leave as-is. */
  colorScheme?: "light" | "dark" | "both";
  /** Add this class to <html> before capture (e.g. to trigger a CSS-class dark theme). Omit for none. */
  themeClass?: string;
  /** Also capture the reel at these viewports; each emits an asset (<name>-<viewport name>). */
  viewports?: ViewportInput[];
  /**
   * Capture several routes and concatenate them into one reel ("frames" path). Emits a single asset
   * (variants skipped; aspect/outputs apply to the final tour).
   */
  routes?: RouteInput[];
  /** Hide elements matching these CSS selectors before capture (cookie banners, chat widgets, …). Default none. */
  hideSelectors?: string[];
  /** Extra CSS injected before capture (e.g. a brand backdrop, or hiding a sticky header). Omit for none. */
  injectCss?: string;
  /** Click these selectors once after load to dismiss overlays (consent dialogs); best-effort. Default none. */
  clickSelectors?: string[];
  /** Hide scrollbars so they don't appear in the capture. Default true. */
  hideScrollbars?: boolean;
  /** Pause CSS animations/transitions for fully static, deterministic frames. Default false. */
  pauseAnimations?: boolean;
  /** Freeze Date.now / performance.now / Math.random (seeded) so time/random content is stable. Default false. */
  freezeClock?: boolean;
  /** Abort common analytics/ads/session-replay requests during capture (cleaner, faster). Default true. */
  blockTrackers?: boolean;
  /** Extra hostname substrings to block during capture. Default none. */
  blockHosts?: string[];
  /** Playwright resource types to block (e.g. "media", "font", "image"). Default none. */
  blockResourceTypes?: string[];
  /** Wait for fonts + in-view images before each frame's screenshot ("frames"). Defaults on (off in draft). */
  settlePerFrame?: boolean;
  /** Max time (ms) to wait per frame for settling before screenshotting anyway. Default 250. */
  settleMaxMs?: number;
  /** Reframe the output to a target aspect: a preset ("16:9"|"9:16"|"1:1") or explicit {width,height}. Omit to keep the capture aspect. */
  aspect?: AspectInput;
  /** How to fit the capture into `aspect`: "cover" (scale + center-crop) or "contain" (scale + pad). Default "cover". */
  fit?: "cover" | "contain";
  /** Pad color used by "contain". Default "#0b0b0f". */
  padColor?: string;
  /** Files to emit per variant; each becomes its own asset. Default ["mp4"]. */
  outputs?: ("mp4" | "gif" | "webp" | "poster")[];
  /** GIF / animated-WebP frame rate. Defaults to min(fps, 15). */
  gifFps?: number;
  /** Intro card shown before the reel (fades from black). Applies to frames / route tours. Omit for none. */
  intro?: CardInput;
  /** Outro / end card shown after the reel. Omit for none. */
  outro?: CardInput;
  /** Timed on-screen annotations (caption text, a highlight ring, or a spotlight on a selector). */
  annotations?: AnnotationInput[];
  /** Output filename; defaults to "<slug(asset name)>.mp4". */
  fileName?: string;
}

/** Author-facing input (documented for editor hover; the schema validates it at run time). */
export type ScrollReelOptions = ScrollReelOptionsInput;
/** Fully-resolved options after parsing. */
export type ResolvedScrollReelOptions = z.infer<typeof scrollReelOptionsSchema>;

// Compile-time guard: the documented authoring type must stay in sync with the schema's input shape.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _scrollReelInputInSync: Exact<
  ScrollReelOptionsInput,
  z.input<typeof scrollReelOptionsSchema>
> = true;
void _scrollReelInputInSync;
