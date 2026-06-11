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
    /** Output filename; defaults to "<slug(asset name)>.mp4". */
    fileName: z.string().optional(),
  })
  .strict();

/** Author-facing input (all optional — defaults applied at run time). */
export type ScrollReelOptions = z.input<typeof scrollReelOptionsSchema>;
/** Fully-resolved options after parsing. */
export type ResolvedScrollReelOptions = z.infer<typeof scrollReelOptionsSchema>;
