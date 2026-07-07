import { z } from "zod";
import { easingSchema, type Easing } from "@/generators/easing";
import { frameCaptureShape, namedViewportSchema, videoOutputShape, type ViewportInput } from "@/generators/shared-options";

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
      .describe('Easing for the travel to this target. Default "ease-in-out".'),
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

/** Pixel size, encoding, and output formats. */
const outputGroupSchema = z
  .object({
    ...videoOutputShape({ width: 1280, height: 800, deviceScaleFactor: 2 }),
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
  })
  .strict()
  .default({});

/** Page-load waiting + dwell at the ends of the scroll. */
const pageGroupSchema = z
  .object({
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
  })
  .strict()
  .default({});

/** Frame-stepped render tuning (parallelism, frame format, per-frame settling). */
const renderGroupSchema = z
  .object({
    ...frameCaptureShape(),
    /** Wait for fonts + in-view images before each frame's screenshot. Defaults on (off in draft). */
    settlePerFrame: z
      .boolean()
      .optional()
      .describe(
        "Wait for fonts + in-view images before each frame's screenshot. Defaults on (off in draft).",
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
  })
  .strict()
  .default({});

/** How the scroll moves: duration/easing, loop, and choreography. */
const motionGroupSchema = z
  .object({
    /** Time to scroll from top to bottom (ms). */
    durationMs: z
      .number()
      .int()
      .positive()
      .default(6000)
      .describe("Time to scroll from top to bottom (ms). Default 6000."),
    easing: easingSchema
      .default("ease-in-out")
      .describe('Easing for the default top→bottom scroll. Default "ease-in-out".'),
    /** Loop style. "boomerang" plays the scroll forward then back within the clip for a seamless loop. */
    loop: z
      .enum(["none", "boomerang"])
      .default("none")
      .describe(
        'Loop style. "boomerang" plays the scroll forward then back for a seamless loop. Default "none".',
      ),
    /**
     * Choreographed scroll: an ordered list of steps instead of one top→bottom sweep. Each step scrolls
     * to a target (a 0..1 number, an "NN%" string, or a CSS selector to bring into view), then holds —
     * the "pause on each section" look. Omit for the default single eased sweep. Clip length becomes
     * startDelay + Σ(step travel + hold) + endDwell.
     */
    choreography: z
      .array(choreographyStepSchema)
      .optional()
      .describe(
        "Choreographed scroll: an ordered list of steps instead of one top→bottom sweep. Omit for the default single eased sweep.",
      ),
    /**
     * Auto-choreograph: detect the page's sections and pan/hold through them automatically (no manual
     * selectors). `true` for defaults, or an object to tune. The clip is a fixed budget (`durationMs`,
     * default 12000) split across detected sections. Ignored if `choreography` is set.
     */
    autoSections: z
      .union([z.boolean(), autoSectionsSchema])
      .optional()
      .describe(
        "Auto-choreograph: detect sections and pan/hold through them. `true` for defaults, or an object to tune. Ignored if `choreography` is set.",
      ),
  })
  .strict()
  .default({});

/** Variant matrix: each cell (color scheme × viewport) is emitted as its own asset. */
const variantsGroupSchema = z
  .object({
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
      .array(namedViewportSchema)
      .optional()
      .describe(
        "Also capture the reel at these viewports; each emits an asset (<name>-<viewport name>).",
      ),
  })
  .strict()
  .default({});

/** Reframe the output to a target aspect. */
const reframeGroupSchema = z
  .object({
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
  })
  .strict()
  .default({});

export const scrollReelOptionsSchema = z
  .object({
    output: outputGroupSchema,
    page: pageGroupSchema,
    render: renderGroupSchema,
    motion: motionGroupSchema,
    variants: variantsGroupSchema,
    reframe: reframeGroupSchema,
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
  /** Easing for the travel to this target. Default "ease-in-out". */
  easing?: Easing;
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

/** Target output aspect: a preset, or an explicit pixel box. */
export type AspectInput = "16:9" | "9:16" | "1:1" | { width: number; height: number };

/** Pixel size, encoding, and output formats. */
export interface ScrollReelOutputInput {
  /** Output width in CSS px. Default 1280. */
  width?: number;
  /** Output height in CSS px. Default 800. */
  height?: number;
  /** Render scale (higher = crisper capture, downscaled into the video). Default 2. */
  deviceScaleFactor?: number;
  /** Output frames per second. Default 30. */
  fps?: number;
  /** x264 quality, 0–51 (lower = better quality / larger file). Default 18. */
  crf?: number;
  /** Output filename; defaults to "<slug(asset name)>.mp4". */
  fileName?: string;
  /** Files to emit per variant; each becomes its own asset. Default ["mp4"]. */
  outputs?: ("mp4" | "gif" | "webp" | "poster")[];
  /** GIF / animated-WebP frame rate. Defaults to min(fps, 15). */
  gifFps?: number;
}

/** Page-load waiting + dwell at the ends of the scroll. */
export interface ScrollReelPageInput {
  /** Dwell at the top before scrolling (ms). Default 500. */
  startDelayMs?: number;
  /** Dwell at the bottom after scrolling (ms). Default 800. */
  endDwellMs?: number;
  /** Page-load milestone to wait for before recording. Default "networkidle". */
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  /** Optional element to wait for before recording (e.g. a hero section). Omit to skip. */
  waitForSelector?: string;
}

/** Frame-stepped render tuning (parallelism, frame format, per-frame settling). */
export interface ScrollReelRenderInput {
  /** Parallel render workers (each its own browser context). Omit to auto-pick from cores + free memory. */
  workers?: number;
  /** Intermediate frame format. "jpeg" (default) is faster; "png" is lossless. Default "jpeg". */
  frameFormat?: "jpeg" | "png";
  /** Wait for fonts + in-view images before each frame's screenshot. Defaults on (off in draft). */
  settlePerFrame?: boolean;
  /** Max time (ms) to wait per frame for settling before screenshotting anyway. Default 250. */
  settleMaxMs?: number;
}

/** How the scroll moves: duration/easing, loop, and choreography. */
export interface ScrollReelMotionInput {
  /** Time to scroll from top to bottom (ms). Default 6000. */
  durationMs?: number;
  /** Easing for the default top→bottom scroll. Default "ease-in-out". */
  easing?: Easing;
  /** Loop style. "boomerang" plays the scroll forward then back for a seamless loop. Default "none". */
  loop?: "none" | "boomerang";
  /**
   * Choreographed scroll: an ordered list of steps instead of one top→bottom sweep. Omit for the
   * default single eased sweep.
   */
  choreography?: ChoreographyStepInput[];
  /**
   * Auto-choreograph: detect the page's sections and pan/hold through them. `true` for defaults,
   * or an object to tune. Ignored if `choreography` is set. Omit to disable.
   */
  autoSections?: boolean | AutoSectionsInput;
}

/** Variant matrix: each cell (color scheme × viewport) is emitted as its own asset. */
export interface ScrollReelVariantsInput {
  /** Force a color scheme. "both" emits a light AND a dark asset (<name>-light / <name>-dark). Omit to leave as-is. */
  colorScheme?: "light" | "dark" | "both";
  /** Add this class to <html> before capture (e.g. to trigger a CSS-class dark theme). Omit for none. */
  themeClass?: string;
  /** Also capture the reel at these viewports; each emits an asset (<name>-<viewport name>). */
  viewports?: ViewportInput[];
}

/** Reframe the output to a target aspect. */
export interface ScrollReelReframeInput {
  /** Reframe the output to a target aspect: a preset ("16:9"|"9:16"|"1:1") or explicit {width,height}. Omit to keep the capture aspect. */
  aspect?: AspectInput;
  /** How to fit the capture into `aspect`: "cover" (scale + center-crop) or "contain" (scale + pad). Default "cover". */
  fit?: "cover" | "contain";
  /** Pad color used by "contain". Default "#0b0b0f". */
  padColor?: string;
}

/**
 * Author-facing options for the `scroll-reel` generator — a frame-stepped video of a page
 * scrolling. By default it eases a single top→bottom scroll; the options below switch it into
 * choreographed / auto-section motion and reframe / re-encode the output. Site-cleanup toggles
 * (hide the cookie banner, block trackers, freeze the clock, …) live in `settings.capture`,
 * applied to every URL capture. For a realtime recording of the live page (scripted cursor,
 * time-based animation) use the `interaction` generator instead. Everything is optional, with
 * the defaults noted below.
 */
export interface ScrollReelOptionsInput {
  /** Pixel size, encoding, and output formats. */
  output?: ScrollReelOutputInput;
  /** Page-load waiting + dwell at the ends of the scroll. */
  page?: ScrollReelPageInput;
  /** Frame-stepped render tuning (parallelism, frame format, per-frame settling). */
  render?: ScrollReelRenderInput;
  /** How the scroll moves: duration/easing, loop, and choreography. */
  motion?: ScrollReelMotionInput;
  /** Variant matrix: each cell (color scheme × viewport) is emitted as its own asset. */
  variants?: ScrollReelVariantsInput;
  /** Reframe the output to a target aspect. */
  reframe?: ScrollReelReframeInput;
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

// Re-exported for callers that consumed these from here before the shared-options split.
export type { Easing } from "@/generators/easing";
export type { ViewportInput } from "@/generators/shared-options";
