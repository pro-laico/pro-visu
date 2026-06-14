import { z } from "zod";

export const easingSchema = z.enum([
  "linear",
  "easeInOutCubic",
  "easeInOutQuad",
  "easeOutCubic",
]);
export type Easing = z.infer<typeof easingSchema>;

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
