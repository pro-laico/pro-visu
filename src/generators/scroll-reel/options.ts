import { z } from "zod";

export const easingSchema = z.enum([
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
export const choreographyStepSchema = z
  .object({
    /** Target: a 0..1 number, an "NN%" string, or a CSS selector to bring into view. */
    to: z.union([z.number(), z.string()]),
    /** Travel time to this target (ms). Default 1200. */
    durationMs: z.number().int().nonnegative().optional(),
    /** Hold time at this target after arriving (ms). Default 800. */
    holdMs: z.number().int().nonnegative().optional(),
    easing: easingSchema.optional(),
  })
  .strict();

/** Tuning for auto-section choreography (see `autoSections` below). */
export const autoSectionsSchema = z
  .object({
    /** Min element height (as a fraction of the viewport) to count as a section. Default 0.5. */
    minHeightFraction: z.number().positive().max(2).optional(),
    /** Explicit section selector; overrides the heuristic. */
    selector: z.string().optional(),
    /** Hold at each detected section (ms). Default 700. */
    holdMs: z.number().int().nonnegative().optional(),
    /** Total clip length (ms) split across detected sections. Default 12000. */
    durationMs: z.number().int().positive().optional(),
    /** Cap on the number of sections. Default 8. */
    maxSections: z.number().int().positive().optional(),
    /** Distribute travel time by distance for uniform scroll speed. Default true. */
    constantVelocity: z.boolean().optional(),
  })
  .strict();

export const scrollReelOptionsSchema = z
  .object({
    /** Viewport + output width in CSS pixels. */
    width: z.number().int().positive().default(1280),
    /** Viewport + output height in CSS pixels. */
    height: z.number().int().positive().default(800),
    /** Render scale (2 = retina-crisp capture, downscaled into the video). */
    deviceScaleFactor: z.number().positive().max(4).default(2),
    /** Output frames per second (re-encoded from the recording). */
    fps: z.number().int().positive().max(120).default(30),
    /** Time to scroll from top to bottom (ms). */
    duration: z.number().int().positive().default(6000),
    easing: easingSchema.default("easeInOutCubic"),
    /** Dwell at the top before scrolling (ms). */
    startDelayMs: z.number().int().nonnegative().default(500),
    /** Dwell at the bottom after scrolling (ms). */
    endDwellMs: z.number().int().nonnegative().default(800),
    waitUntil: z
      .enum(["load", "domcontentloaded", "networkidle", "commit"])
      .default("networkidle"),
    /** Optional element to wait for before recording (e.g. a hero section). */
    waitForSelector: z.string().optional(),
    /** x264 quality, 0–51 (lower = better/larger). */
    crf: z.number().int().min(0).max(51).default(18),
    /**
     * Capture strategy. "frames" (default) steps a virtual clock, sets the scroll position per frame and
     * screenshots — frame-accurate, crisp (supersampled) and reproducible. "realtime" records the live
     * browser session; use it only when the page's hero relies on time-based (not scroll-driven)
     * animation or autoplay video that should play during the capture.
     */
    capture: z.enum(["frames", "realtime"]).default("frames"),
    /** Parallel render workers for "frames" (each its own browser context). Omit to auto-pick by cores. */
    workers: z.number().int().positive().optional(),
    /** Intermediate frame format for "frames"; "png" is lossless (slower), "jpeg" (default) is faster. */
    frameFormat: z.enum(["jpeg", "png"]).default("jpeg"),

    /**
     * Choreographed scroll: an ordered list of steps instead of one top→bottom sweep. Each step scrolls
     * to a target (a 0..1 number, an "NN%" string, or a CSS selector to bring into view), then holds —
     * the "pause on each section" look. "frames" capture only (ignored by "realtime"). Omit for the
     * default single eased sweep. Clip length becomes startDelay + Σ(step travel + hold) + endDwell.
     */
    choreography: z.array(choreographyStepSchema).optional(),

    /**
     * Auto-choreograph: detect the page's sections and pan/hold through them automatically (no manual
     * selectors). `true` for defaults, or an object to tune. The clip is a fixed budget (`durationMs`,
     * default 12000) split across detected sections. "frames" capture only; ignored if `choreography`
     * is set.
     */
    autoSections: z.union([z.boolean(), autoSectionsSchema]).optional(),

    /** Loop style. "boomerang" plays the scroll forward then back within the clip for a seamless loop. */
    loop: z.enum(["none", "boomerang"]).default("none"),

    /**
     * Ken Burns: a slow zoom over the clip ("frames" only). Scales the page toward an origin each frame
     * (folds automatically under a boomerang loop to stay seamless). May affect position:fixed elements —
     * pair with clean-capture if needed.
     */
    kenBurns: z
      .object({
        /** Start scale (1 = no zoom). Default 1. */
        scaleFrom: z.number().positive().optional(),
        /** End scale. Default 1.08. */
        scaleTo: z.number().positive().optional(),
        easing: easingSchema.optional(),
        /** Zoom origin X within the viewport (0 = left, 1 = right). Default 0.5. */
        originX: z.number().min(0).max(1).optional(),
        /** Zoom origin Y within the viewport (0 = top, 1 = bottom). Default 0.5. */
        originY: z.number().min(0).max(1).optional(),
      })
      .strict()
      .optional(),

    // --- variants (each emitted as its own asset; "frames" path) ---
    /** Force a color scheme. "both" emits a light AND a dark asset (<name>-light / <name>-dark). */
    colorScheme: z.enum(["light", "dark", "both"]).optional(),
    /** Add this class to <html> before capture (e.g. to trigger a CSS-class dark theme). */
    themeClass: z.string().optional(),
    /** Capture the same reel at multiple viewports; each emits an asset (<name>-<viewport name>). */
    viewports: z
      .array(
        z
          .object({
            name: z.string(),
            width: z.number().int().positive(),
            height: z.number().int().positive(),
            deviceScaleFactor: z.number().positive().max(4).optional(),
          })
          .strict(),
      )
      .optional(),

    // --- clean capture (suppress real-site noise; applied on the "frames" path) ---
    /** Hide elements matching these CSS selectors before capture (cookie banners, chat widgets, …). */
    hideSelectors: z.array(z.string()).default([]),
    /** Extra CSS injected before capture (e.g. a brand backdrop, or hiding a sticky header). */
    injectCss: z.string().optional(),
    /** Click these selectors once after load to dismiss overlays (consent dialogs); best-effort. */
    clickSelectors: z.array(z.string()).default([]),
    /** Hide scrollbars so they don't appear in the capture. */
    hideScrollbars: z.boolean().default(true),
    /** Pause CSS animations/transitions for fully static, deterministic frames. */
    pauseAnimations: z.boolean().default(false),
    /** Freeze Date.now / performance.now / Math.random (seeded) so time/random content is stable. */
    freezeClock: z.boolean().default(false),
    /** Abort common analytics/ads/session-replay requests during capture (cleaner, faster). */
    blockTrackers: z.boolean().default(true),
    /** Extra hostname substrings to block during capture. */
    blockHosts: z.array(z.string()).default([]),
    /** Playwright resource types to block (e.g. "media", "font", "image"). */
    blockResourceTypes: z.array(z.string()).default([]),

    // --- per-frame settling ("frames" path) ---
    /** Wait for fonts + in-view images before each frame's screenshot. Defaults on (off in draft). */
    settlePerFrame: z.boolean().optional(),
    /** Max time (ms) to wait per frame for settling before screenshotting anyway. */
    settleMaxMs: z.number().int().nonnegative().default(250),

    /** Output filename; defaults to "<slug(asset name)>.mp4". */
    fileName: z.string().optional(),
  })
  .strict();

/** Author-facing input (all optional — defaults applied at run time). */
export type ScrollReelOptions = z.input<typeof scrollReelOptionsSchema>;
/** Fully-resolved options after parsing. */
export type ResolvedScrollReelOptions = z.infer<typeof scrollReelOptionsSchema>;
