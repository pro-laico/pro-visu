import { z } from "zod";
import {
  wallColumnSchema,
  wallPanSchema,
  wallPulseSchema,
  fauxTileSchema,
  type WallPanInput,
  type WallColumnInput,
  type WallPulseInput,
  type FauxTileInput,
} from "@/generators/scene/scene-options";

/**
 * Author-facing options for the `wall` generator — a media wall whose `columns` are self-contained
 * units: each column owns its `tiles` (the assets stacked in it, by name) AND its own Y motion. The
 * dependency map is derived from those tile names, so there's no separate `inputs` list to maintain.
 *
 * Motion is built from one uniform "pulse" primitive, shared by columns, the wall-level default, and
 * the pan. A track's travel = `loops` continuous whole-clip periods + the sum of its `pulses` (each
 * an eased move of `distance` periods starting at `at`, lasting `duration` — both 0..1 fractions of
 * the clip). The total is rounded UP to a whole number of periods — the remainder folds into the
 * continuous scroll — so every track lands back on its start at the clip's end: the wall ALWAYS loops
 * seamlessly. (A pulse with `at + duration > 1` is shifted back to end at the loop point, so it can
 * never overrun the clip.)
 *   `pan`     — System 1: the whole wall pans on X.
 *   `columns` — System 2: each column scrolls on Y (its own `direction` / `loops` / `pulses`).
 */
export const wallOptionsSchema = z
  .object({
    // --- output ---
    /** Output width (CSS px). */
    width: z.number().int().positive().default(1920).describe("Output width in CSS px. Default 1920."),
    /** Output height (CSS px). */
    height: z.number().int().positive().default(1080).describe("Output height in CSS px. Default 1080."),
    /** Render scale (2 = retina-crisp, downscaled into the video). */
    deviceScaleFactor: z
      .number()
      .positive()
      .max(4)
      .default(2)
      .describe("Render scale (2 = retina-crisp, downscaled into the video). Default 2."),
    /** Output frames per second. */
    fps: z.number().int().positive().max(120).default(30).describe("Output frames per second. Default 30."),
    /** Clip length (seconds) — the whole loop. Tile videos should loop within a length dividing this. */
    durationSeconds: z
      .number()
      .positive()
      .default(16)
      .describe("Clip length in seconds — the whole loop. Default 16."),
    /** x264 quality, 0–51 (lower = better/larger). */
    crf: z
      .number()
      .int()
      .min(0)
      .max(51)
      .default(18)
      .describe("x264 quality, 0–51 (lower = better quality / larger file). Default 18."),
    /** Capture strategy. "frames" (default) is deterministic + parallelizable. */
    capture: z
      .enum(["frames", "realtime"])
      .default("frames")
      .describe('Capture strategy. "frames" (default) is deterministic + parallelizable; "realtime" records the live session.'),
    /** Parallel frame-render workers. Video-heavy walls can cold-start black under many workers —
     *  set 1 (or omit) for those. */
    workers: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Parallel frame-render workers. Video-heavy walls can cold-start to black under many workers — set 1 (or omit). Auto-picks from cores."),
    /** Intermediate frame format (frames capture only). "jpeg" (default) is fast; "png" is lossless. */
    frameFormat: z
      .enum(["jpeg", "png"])
      .default("jpeg")
      .describe('Intermediate frame format (frames capture). "jpeg" (default) is fast; "png" is lossless.'),
    /** Backdrop shown in the gutters between tiles. */
    background: z
      .string()
      .default("#0b0b0f")
      .describe('Backdrop shown in the gutters between tiles. Default "#0b0b0f".'),
    /** Output filename; defaults to "<slug(asset name)>.mp4". */
    fileName: z.string().optional().describe('Output filename; defaults to "<slug(asset name)>.mp4".'),

    // --- columns (System 2 + layout): each column = its tiles + its own motion ---
    /** The columns (≥3) — each its own tiles + motion. Count = array length (fewer = larger tiles). */
    columns: z
      .array(wallColumnSchema)
      .min(3)
      .describe("The columns (≥3) — each lists its stacked `tiles` (by name) and may carry its own motion. Count = columns.length."),
    /** Gap between columns and between tiles (px). */
    gap: z.number().nonnegative().default(8).describe("Gap between columns and between tiles (px). Default 8."),
    /** Default/fallback tile aspect (width / height). Tiles fit the column width and take their OWN
     *  height from their media's aspect (16:9 → short, 9:16 → tall); this is only used for faux
     *  (`test`) tiles that don't set their own `aspect`. 0.75 = 3:4 portrait. */
    tileAspect: z
      .number()
      .positive()
      .default(0.75)
      .describe("Default/fallback tile aspect (w/h) — only for faux (test) tiles without their own `aspect`. 0.75 = 3:4 portrait. Default 0.75."),
    /** Tile corner radius (px). */
    cornerRadius: z.number().nonnegative().default(6).describe("Tile corner radius (px). Default 6."),

    // --- motion (uniform pulse model) ---
    /** System 1 — the whole-wall X pan. */
    pan: wallPanSchema
      .default({})
      .describe("System 1 — the whole wall's horizontal pan (`direction` / `loops` / `pulses`). Default: no pan."),
    /** Default continuous whole-clip loops for columns that omit their own `loops` (0 = static unless
     *  a pulse moves it; one pulse then rounds the total up to a single loop). */
    loops: z
      .number()
      .nonnegative()
      .default(0)
      .describe("Default continuous whole-clip loops for columns that omit their own `loops`. Default 0 (static unless a pulse moves it)."),
    /** Default pulses for columns that omit their own `pulses` (the uniform wall-level motion). */
    pulses: z
      .array(wallPulseSchema)
      .default([])
      .describe("Default pulses for columns that omit their own `pulses` (the uniform wall-level motion). Default none."),

    // --- test / preview ---
    /** Preview mode: render every tile as a flat labeled color box (see `testTiles`) instead of the
     *  real assets. No producer assets run, so the wall renders in seconds — use it to dial in
     *  layout + motion, then turn it off for the real render. */
    test: z
      .boolean()
      .default(false)
      .describe("Preview mode: render every tile as a flat labeled color box instead of real assets, so the wall renders in seconds. Default false."),
    /** Per-tile faux appearance for `test` mode, keyed by tile name. Tiles not listed get an
     *  auto-derived color and their name as the label. */
    testTiles: z
      .record(z.string(), fauxTileSchema)
      .default({})
      .describe("Per-tile faux appearance for `test` mode, keyed by tile name (color + caption). Default {} (auto colors + names)."),
  })
  .strict();

// ---------------------------------------------------------------------------
// Author-facing input type (editor autocomplete + hover docs). JSDoc on the
// zod schema above does NOT surface on hover through `z.input`, so the docs
// live on this hand-written interface, kept in sync with the schema by the
// Exact<> guard at the bottom — a drift is a compile error.
// ---------------------------------------------------------------------------

/** Re-exported so configs can type a single column / pulse / pan / faux tile. */
export type { WallColumnInput, WallPanInput, WallPulseInput, FauxTileInput };

/**
 * Author-facing options for the `wall` generator. Each entry in `columns` is a self-contained unit
 * (its `tiles` + its own optional motion); everything else is optional, with defaults noted below.
 * Motion is the uniform pulse model: `loops` (continuous base) + `pulses` (eased moves), summed and
 * rounded up to a whole number of periods so the wall always loops seamlessly.
 */
export interface WallOptionsInput {
  // --- output ---
  /** Output width in CSS px. Default 1920. */
  width?: number;
  /** Output height in CSS px. Default 1080. */
  height?: number;
  /** Render scale (2 = retina-crisp, downscaled into the video). Default 2. */
  deviceScaleFactor?: number;
  /** Output frames per second. Default 30. */
  fps?: number;
  /** Clip length in seconds — the whole loop. Default 16. */
  durationSeconds?: number;
  /** x264 quality, 0–51 (lower = better quality / larger file). Default 18. */
  crf?: number;
  /**
   * Capture strategy. "frames" (default) is deterministic + parallelizable; "realtime" records the
   * live session. Default "frames".
   */
  capture?: "frames" | "realtime";
  /**
   * Parallel frame-render workers. Video-heavy walls can cold-start to black tiles under many
   * workers — set 1 (or omit) for those. Omit to auto-pick from cores.
   */
  workers?: number;
  /** Intermediate frame format (frames capture). "jpeg" (default) is fast; "png" is lossless. */
  frameFormat?: "jpeg" | "png";
  /** Backdrop shown in the gutters between tiles. Default "#0b0b0f". */
  background?: string;
  /** Output filename; defaults to "<slug(asset name)>.mp4". */
  fileName?: string;

  // --- columns: each its own tiles + motion ---
  /**
   * The columns (≥3). Each column lists the assets stacked in it (`tiles`, by name — cycled to fill
   * the height) and may carry its own motion (`direction` / `loops` / `pulses`); omitted `loops` /
   * `pulses` inherit the wall-level defaults below. Column count = `columns.length`.
   */
  columns: WallColumnInput[];
  /** Gap between columns and between tiles (px). Default 8. */
  gap?: number;
  /** Default/fallback tile aspect (width / height). Tiles fit the column width and take their OWN
   *  height from their media's aspect (16:9 → short, 9:16 → tall); this is only used for faux
   *  (`test`) tiles that don't set their own `aspect`. 0.75 = 3:4 portrait. Default 0.75. */
  tileAspect?: number;
  /** Tile corner radius (px). Default 6. */
  cornerRadius?: number;

  // --- motion (uniform pulse model) ---
  /** The whole wall's horizontal pan (`direction` / `loops` / `pulses`). Default: no pan. */
  pan?: WallPanInput;
  /** Default continuous whole-clip loops for columns that omit their own `loops`. Default 0 (static
   *  unless a pulse moves it — a single pulse then rounds up to one loop). */
  loops?: number;
  /** Default pulses for columns that omit their own `pulses` (the uniform wall-level motion). Default none. */
  pulses?: WallPulseInput[];

  // --- test / preview ---
  /**
   * Preview mode: render every tile as a flat labeled color box instead of the real assets. No
   * producer assets run, so the wall renders in seconds — flip it on to dial in layout + motion,
   * then off for the real render. Default false.
   */
  test?: boolean;
  /** Per-tile faux appearance for `test` mode, keyed by tile name (color + caption). Default {} (auto colors + names). */
  testTiles?: Record<string, FauxTileInput>;
}

/** Author-facing input (documented for editor hover; the schema validates it at run time). */
export type WallOptions = WallOptionsInput;
/** Fully-resolved options after parsing. */
export type ResolvedWallOptions = z.infer<typeof wallOptionsSchema>;

// Compile-time guard: the documented authoring type must stay in sync with the schema's input shape.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _wallInputInSync: Exact<WallOptionsInput, z.input<typeof wallOptionsSchema>> = true;
void _wallInputInSync;
