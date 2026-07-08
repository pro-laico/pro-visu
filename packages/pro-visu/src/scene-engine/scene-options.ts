import { z } from "zod";
import { easingSchema } from "@/generators/easing";

/**
 * The specimen wire pulse — the scene runs on SECONDS internally; the friendly specimen generator
 * authors in milliseconds (`durationMs`) and converts before serializing.
 */
const specimenWirePulseSchema = z
  .object({
    name: z.string().default(""),
    /** Length of this beat, in seconds (wire unit). */
    duration: z.number().positive(),
    chars: z.number().nonnegative().default(0),
    colors: z.number().nonnegative().default(0),
    color: z.enum(["foreground", "muted", "accent"]).optional(),
    pacing: z
      .enum(["even", "linear", "ease-in", "ease-out", "ease-in-out", "random"])
      .default("even"),
  })
  .strict();

/**
 * Per-scene `sceneOptions` schemas — the knobs each built-in scene understands. `renderScene`
 * validates against the selected scene's schema before serializing props, so a typo'd key or an
 * unknown scene id fails fast with a named error instead of silently rendering defaults. Every
 * default equals the value the scene previously hardcoded, so existing configs render identically.
 *
 * The author-facing *Input interfaces below mirror each schema's input shape (compile-time-guarded);
 * the friendly `wall` / `specimen` / `palette-reel` generators own the config authoring surface.
 */

/**
 * The specimen scene's wire format — produced by the specimen *generator* (its friendly options
 * are the real authoring surface), validated here so generator and scene can't drift apart.
 */
const specimenSceneOptionsSchema = z
  .object({
    // The name label: its text plus placement/styling within the bottom gap area. The specimen
    // generator folds its friendly `name` + `label` options into this one object.
    label: z
      .object({
        text: z.string().default(""),
        anchor: z
          .enum([
            "top-left",
            "top-center",
            "top-right",
            "middle-left",
            "middle-center",
            "middle-right",
            "bottom-left",
            "bottom-center",
            "bottom-right",
          ])
          .default("bottom-left"),
        padding: z.number().nonnegative().default(32),
        size: z.number().positive().max(1).default(0.22),
        weight: z.number().int().min(1).max(1000).default(500),
        color: z.string().optional(),
      })
      .partial()
      .default({}),
    demo: z.boolean().default(false),
    weight: z.number().min(1).max(1000).default(400),
    lines: z.number().int().min(1).max(40).default(3),
    /** Fraction of the frame height the glyph rows fill (bottom strip = label gap area). */
    fill: z.number().positive().max(1).default(0.8),
    blacklist: z.string().default(""),
    colors: z
      .object({
        background: z.string(),
        foreground: z.string(),
        muted: z.string(),
        accent: z.string().optional(),
      })
      .partial()
      .default({}),
    colorWeights: z
      .object({
        foreground: z.number().nonnegative(),
        muted: z.number().nonnegative(),
        accent: z.number().nonnegative(),
      })
      .partial()
      .default({}),
    pulses: z.array(specimenWirePulseSchema).default([]),
    mirror: z.boolean().default(true),
    characterIntensity: z.number().nonnegative().default(1),
    colorIntensity: z.number().nonnegative().default(1),
    /** Max fraction a line's width may drift as glyphs change (right-edge stability). */
    maxLineDrift: z.number().positive().max(0.5).default(0.05),
    /** Schedule seed — same seed ⇒ identical animation (parallel workers must agree). */
    seed: z.number().int().default(1),
    /** Line-height of the glyph block. */
    leading: z.number().positive().default(0.78),
    /** Glyph pool override (≥2 distinct characters after the blacklist). */
    characterPool: z.string().min(2).optional(),
  })
  .strict();

/** The shared easing vocabulary (scene-side alias). */
const wallEasingEnum = easingSchema;

/**
 * One "pulse" — the uniform motion primitive shared by columns, the wall-level default, and the pan.
 * It adds `distance` periods of eased travel, starting at `at` and lasting `span` — both 0..1
 * fractions of the clip. If `at + span > 1`, the start shifts back so the move ends exactly at the
 * loop point (a 0.2 pulse at 0.9 starts at 0.8), so a pulse can never overrun the clip.
 */
export const wallPulseSchema = z
  .object({
    /** When the pulse starts, as a fraction of the clip (0..1). */
    at: z.number().min(0).max(1).describe("When the pulse starts, as a fraction of the clip (0..1)."),
    /** How long the move takes, as a fraction of the clip (0..1). */
    span: z
      .number()
      .positive()
      .max(1)
      .describe("How long the move takes, as a fraction of the clip (0..1)."),
    /** How far it travels, in periods (1 = one full tile-set / one wrap). Usually 0..1. */
    distance: z
      .number()
      .nonnegative()
      .describe("How far it travels, in periods (1 = one full tile-set / wrap). Usually 0..1."),
    /** Easing of the move's ramp. */
    easing: wallEasingEnum.default("ease-in-out").describe("Easing of the move's ramp. Default 'ease-in-out'."),
  })
  .strict();

/** System 1 — the whole-wall X pan: a continuous base scroll (`loops`) + optional `pulses`. */
export const wallPanSchema = z
  .object({
    /** Pan direction. */
    direction: z.enum(["left", "right"]).default("left").describe("Pan direction. Default 'left'."),
    /** Continuous whole-clip horizontal loops (0 = no pan unless `pulses` move it). */
    loops: z
      .number()
      .nonnegative()
      .default(0)
      .describe("Continuous whole-clip horizontal loops (0 = no pan unless pulses move it). Default 0."),
    /** Pulses added on top of the base loops. */
    pulses: z.array(wallPulseSchema).default([]).describe("Pulses added on top of the base loops."),
  })
  .strict();

/**
 * One column of the wall: its tiles (the assets stacked in it, by name — cycled to fill the column
 * height) plus its own optional Y motion. Omitted `loops`/`pulses` inherit the wall-level defaults;
 * an omitted `direction` defaults to "down".
 */
export const wallColumnSchema = z
  .object({
    /** Assets stacked in this column, by name (cycled to fill the height). At least one. */
    tiles: z
      .array(z.string().min(1))
      .min(1)
      .describe("Assets stacked in this column, by name (cycled to fill the height). At least one."),
    /** Constant start-position shift, 0..1 of a tile-set — de-aligns columns with similar content. */
    stagger: z
      .number()
      .min(0)
      .max(1)
      .default(0)
      .describe("Start-position shift (0..1 of a tile-set) that de-aligns columns with similar content. Default 0."),
    /** Scroll direction. Defaults to "down". */
    direction: z.enum(["up", "down"]).optional().describe("Scroll direction. Default 'down'."),
    /** Continuous whole-clip loops for this column. Omit to inherit the wall-level `loops`. */
    loops: z
      .number()
      .nonnegative()
      .optional()
      .describe("Continuous whole-clip loops for this column. Omit to inherit the wall-level loops."),
    /** This column's pulses. Omit to inherit the wall-level `pulses`. */
    pulses: z
      .array(wallPulseSchema)
      .optional()
      .describe("This column's pulses. Omit to inherit the wall-level pulses."),
  })
  .strict();

/**
 * A faux tile for the wall's `test` preview mode — a flat colored box labeled with its name, rendered
 * instead of a real asset so layout + motion can be dialed in instantly (no producers run).
 */
export const fauxTileSchema = z
  .object({
    /** Box fill (any CSS color). Omit to auto-derive a distinct color from the tile name. */
    color: z
      .string()
      .optional()
      .describe("Box fill (any CSS color). Omit to auto-derive a distinct color from the tile name."),
    /** Optional caption shown under the name (e.g. "16:9") — purely cosmetic. */
    caption: z.string().optional().describe("Optional caption shown under the name (e.g. 16:9) — purely cosmetic."),
    /** This faux tile's aspect ratio (width / height): 1.78 = 16:9 (short), 0.56 = 9:16 (tall), 1 =
     *  square. Omit to use the wall's `tileAspect` default. Real tiles use their media's own aspect. */
    aspect: z
      .number()
      .positive()
      .optional()
      .describe("Faux tile aspect (w/h): 1.78 = 16:9, 0.56 = 9:16, 1 = square. Omit to use the wall's tileAspect."),
  })
  .strict();

/**
 * The "wall" scene: a marquee of media tiles, each column a self-contained unit (its `tiles` + its
 * own motion). Two systems built from the SAME pulse primitive: `pan` (System 1, whole-wall X) and
 * the per-column Y motion (System 2). A track's travel = `loops` continuous periods + the sum of its
 * `pulses`; the total is rounded UP to a whole number of periods (the remainder folds into the
 * continuous scroll), so every track lands back on its start at the clip end → a seamless loop.
 */
export const wallSceneOptionsSchema = z
  .object({
    /** The columns (≥3) — each its own tiles + motion. Count = array length (fewer = bigger tiles). */
    columns: z.array(wallColumnSchema).min(3),
    /** Gap between columns and between their tile contents (px). */
    gap: z.number().nonnegative().default(16),
    /** Default/fallback tile aspect (width / height). Tiles fit the column width and take their OWN
     *  height from their media's aspect (16:9 → short, 9:16 → tall); this is only used for faux
     *  (`test`) tiles that don't set their own `aspect`. 1.6 = 16:10 landscape, <1 = portrait. */
    tileAspect: z.number().positive().default(1.6),
    /** Tile corner radius (px). */
    cornerRadius: z.number().nonnegative().default(12),
    /** Backdrop shown in the gap gutters and behind tiles. Defaults to the scene's `background`. */
    background: z.string().optional(),
    /** System 1 — the X pan. */
    pan: wallPanSchema.default({}),
    /** Default continuous whole-clip loops for columns that omit their own `loops` (0 = static unless
     *  a pulse moves it; one pulse then rounds the total up to a single loop). */
    loops: z.number().nonnegative().default(0),
    /** Default pulses for columns that omit their own `pulses` (the uniform wall-level motion). */
    pulses: z.array(wallPulseSchema).default([]),
    /** Preview mode: render every tile as a flat labeled color box (see `testTiles`) instead of the
     *  real assets, so you can dial in layout + motion instantly — no producers run. */
    test: z.boolean().default(false),
    /** Per-tile faux appearance for `test` mode, keyed by tile name. Tiles not listed get an
     *  auto-derived color and their name as the label. */
    testTiles: z.record(z.string(), fauxTileSchema).default({}),
  })
  .strict();

/**
 * The "palette-reel" scene's wire format — produced by the `palette-reel` *generator* (its friendly
 * options are the real authoring surface; it precomputes the per-color display strings since the
 * scene can't import the color math), validated here so generator and scene can't drift apart. The
 * colors start as name-only slivers; one at a time a band expands to reveal its `details`, holds, and
 * collapses, looping seamlessly. Defaults mirror the friendly schema so a direct `scene:
 * "palette-reel"` config still renders.
 */
const reelItemSchema = z
  .object({
    /** Color display name (already cased per `uppercase`). */
    name: z.string(),
    /** Swatch background hex (`#RRGGBB`). */
    hex: z.string(),
    /** Contrast-picked text color for this band. */
    textColor: z.string(),
    /** Preformatted detail lines revealed on expand (hex / oklch / rgb …). */
    details: z.array(z.string()),
  })
  .strict();

const paletteReelSceneOptionsSchema = z
  .object({
    items: z.array(reelItemSchema).min(1),
    orientation: z.enum(["rows", "columns"]).default("rows"),
    holdSeconds: z.number().positive().default(2),
    transitionSeconds: z.number().positive().default(0.7),
    bounce: z.boolean().default(true),
    easing: easingSchema.default("ease-in-out"),
    grownFlex: z.number().min(1).default(12),
    minCrossPx: z.number().nonnegative().default(0),
    nameAlwaysVisible: z.boolean().default(true),
    fontWeight: z.number().int().min(1).max(1000).default(700),
    fontSize: z.number().positive().optional(),
    detailFontScale: z.number().positive().default(0.62),
    gap: z.number().nonnegative().default(0),
    cornerRadius: z.number().nonnegative().default(0),
  })
  .strict();

/**
 * One eased sweep of an effect across the icon grid — the single motion primitive of the `icons`
 * scene, shared with the friendly `icons` generator (which owns the authoring surface). A step's
 * `order` sets each icon's PHASE across the grid and `stagger` sets how much of `span` that phase
 * spreads over: `stagger: 0` fires every targeted icon at once (a pattern), `stagger: 1` walks them
 * one-at-a-time. So every preset interaction is this one primitive with different `order`/`stagger`.
 */
export const iconEffectSchema = z
  .object({
    /** What to animate. */
    kind: z
      .enum(["scale", "color", "opacity", "rotate", "spin"])
      .describe("What to animate: scale, color, opacity, rotate (to an angle), or spin (full turns)."),
    /** When the step starts, as a fraction of the clip (0..1). */
    at: z.number().min(0).max(1).describe("When the step starts, as a fraction of the clip (0..1)."),
    /** How long the step lasts, as a fraction of the clip (0..1). */
    span: z.number().positive().max(1).describe("How long the step lasts, as a fraction of the clip (0..1)."),
    /** Sweep order across the grid (each icon's phase). */
    order: z
      .enum([
        "forward",
        "reverse",
        "random",
        "rows",
        "columns",
        "diagonal",
        "radial-in",
        "radial-out",
        "spiral",
      ])
      .default("forward")
      .describe("Sweep order across the grid (each icon's phase). Default 'forward'."),
    /** How much of `span` the phase spreads over: 0 = all at once (a pattern), 1 = one-at-a-time. */
    stagger: z
      .number()
      .min(0)
      .max(1)
      .default(0.6)
      .describe("How much of `span` the phase spreads over: 0 = all at once (a pattern), 1 = one-at-a-time. Default 0.6."),
    /** Which icons participate. */
    targets: z
      .enum(["all", "even", "odd", "checkerboard", "rows-alt", "cols-alt"])
      .default("all")
      .describe("Which icons participate ('all' or a pattern: even/odd/checkerboard/rows-alt/cols-alt). Default 'all'."),
    /** Easing of each icon's ramp. */
    easing: easingSchema.default("ease-in-out").describe("Easing of each icon's ramp. Default 'ease-in-out'."),
    /** Bounce back to base by the end of the icon's slice (true) or latch at the target (false). */
    return: z
      .boolean()
      .default(true)
      .describe("Bounce back to base by the end of the icon's slice (true) or latch at the target (false). Default true."),
    /** Fraction of each icon's slice held at the peak before it returns (0..1). Ignored when `return` is false. */
    hold: z
      .number()
      .min(0)
      .max(1)
      .default(0.3)
      .describe("Fraction of each icon's slice held at the peak before returning (0..1). Default 0.3."),
    /** Scales the effect's strength (0..1). */
    intensity: z.number().min(0).max(1).default(1).describe("Scales the effect's strength (0..1). Default 1."),
    /** scale: target size multiplier (1 = base). */
    scale: z.number().positive().optional().describe("scale: target size multiplier (1 = base). Default 1.6."),
    /** color / spin colour: target colour (any hex or rgb()). */
    color: z.string().optional().describe("color: target colour (any hex or rgb())."),
    /** opacity: target opacity (0..1). */
    opacity: z.number().min(0).max(1).optional().describe("opacity: target opacity (0..1). Default 1."),
    /** rotate: target angle in degrees. */
    angle: z.number().optional().describe("rotate: target angle in degrees. Default 90."),
    /** spin: full turns over the icon's slice. */
    turns: z.number().optional().describe("spin: full turns over the icon's slice. Default 1."),
  })
  .strict();

/**
 * The "icons" scene: a centred grid of uniform icons on a solid backdrop, animated by a list of
 * effect steps (see {@link iconEffectSchema}). Icons are tinted via a CSS mask (recolourable) unless
 * `recolor` is false. Produced by the friendly `icons` *generator* (its options are the authoring
 * surface); the ordered `icons` here are served-file slot names.
 */
export const iconsSceneOptionsSchema = z
  .object({
    /** Ordered served-file slot names for the icons (the generator populates the matching `files`). */
    icons: z.array(z.string().min(1)).min(1),
    /** Fixed column count. Omit to auto-pick a near-square grid from the count + frame aspect. */
    columns: z.number().int().positive().optional(),
    /** Gap between icons (px). */
    gap: z.number().nonnegative().default(32),
    /** Padding around the grid (px). */
    padding: z.number().nonnegative().default(64),
    /** Icon cell size (px). Omit to fit the grid to the frame. */
    iconSize: z.number().positive().optional(),
    /** Backdrop behind the grid. Defaults to the scene's `background`. */
    background: z.string().optional(),
    /** Tint icons via a CSS mask (recolourable). False renders them natively (original colours). */
    recolor: z.boolean().default(true),
    /** Resting icon colour (tint mode). */
    baseColor: z.string().default("#f4f4f5"),
    /** Resting icon scale multiplier. */
    baseScale: z.number().positive().default(1),
    /** Resting icon opacity (0..1). */
    baseOpacity: z.number().min(0).max(1).default(1),
    /** The animation: an ordered list of effect steps (folded in order). */
    steps: z.array(iconEffectSchema).default([]),
    /** Seed for `random` sweep orders — same seed ⇒ identical animation. */
    seed: z.number().int().default(1),
  })
  .strict();

/** Scene id → its sceneOptions validator. The single source of truth for known scenes. */
export const SCENE_OPTION_SCHEMAS = {
  icons: iconsSceneOptionsSchema,
  specimen: specimenSceneOptionsSchema,
  wall: wallSceneOptionsSchema,
  "palette-reel": paletteReelSceneOptionsSchema,
} as const;

export type SceneId = keyof typeof SCENE_OPTION_SCHEMAS;

// ---------------------------------------------------------------------------
// Author-facing input types (editor autocomplete). Kept in sync with the zod
// schemas by the Exact<> guards at the bottom — a drift is a compile error.
// ---------------------------------------------------------------------------

/** The wall's easing curves. */
export type WallEasing = z.infer<typeof wallEasingEnum>;

/** One eased move — the uniform motion primitive (columns, wall default, and pan all use it). */
export interface WallPulseInput {
  /** When the pulse starts, as a fraction of the clip (0..1). */
  at: number;
  /** How long the move takes, as a fraction of the clip (0..1). If `at + span > 1`, the start
   *  shifts back so the move ends at the loop point. */
  span: number;
  /** How far it travels, in periods (1 = one full tile-set / one wrap). Usually 0..1. */
  distance: number;
  /** Easing of the move's ramp. Default "ease-in-out". */
  easing?: WallEasing;
}

export interface WallPanInput {
  /** Pan direction. Default "left". */
  direction?: "left" | "right";
  /** Continuous whole-clip horizontal loops (0 = no pan unless `pulses` move it). Default 0. */
  loops?: number;
  /** Pulses added on top of the base loops. Default none. */
  pulses?: WallPulseInput[];
}

/** One column of the wall: its tiles (assets by name) + its own optional Y motion. */
export interface WallColumnInput {
  /** Assets stacked in this column, by name (cycled to fill the height). At least one. */
  tiles: string[];
  /** Constant start-position shift, 0..1 of a tile-set — de-aligns columns with similar content. Default 0. */
  stagger?: number;
  /** Scroll direction. Defaults to "down". */
  direction?: "up" | "down";
  /** Continuous whole-clip loops for this column. Omit to inherit the wall-level `loops`. */
  loops?: number;
  /** This column's pulses. Omit to inherit the wall-level `pulses`. */
  pulses?: WallPulseInput[];
}

/** A faux tile for `test` preview mode — a flat color box labeled with its name. */
export interface FauxTileInput {
  /** Box fill (any CSS color). Omit to auto-derive a distinct color from the tile name. */
  color?: string;
  /** Optional caption shown under the name (e.g. "16:9") — purely cosmetic. */
  caption?: string;
  /** This faux tile's aspect ratio (width / height): 1.78 = 16:9 (short), 0.56 = 9:16 (tall), 1 =
   *  square. Omit to use the wall's `tileAspect` default. Real tiles use their media's own aspect. */
  aspect?: number;
}

export interface WallSceneOptionsInput {
  /** The columns (≥3), each its own tiles + motion. Count = array length (fewer = bigger tiles). */
  columns: WallColumnInput[];
  /** Gap between columns and between their tile contents (px). Default 16. */
  gap?: number;
  /** Default/fallback tile aspect (width / height). Tiles fit the column width and take their OWN
   *  height from their media's aspect (16:9 → short, 9:16 → tall); this is only used for faux
   *  (`test`) tiles that don't set their own `aspect`. 1.6 = 16:10 landscape, <1 = portrait. Default 1.6. */
  tileAspect?: number;
  /** Tile corner radius (px). Default 12. */
  cornerRadius?: number;
  /** Backdrop shown in the gap gutters and behind tiles. Defaults to the scene's `background`. */
  background?: string;
  /** System 1 — the whole-wall X pan. Default: no pan. */
  pan?: WallPanInput;
  /** Default continuous whole-clip loops for columns that omit their own `loops`. Default 0 (static
   *  unless a pulse moves it — a single pulse then rounds up to one loop). */
  loops?: number;
  /** Default pulses for columns that omit their own `pulses` (the uniform wall-level motion). Default none. */
  pulses?: WallPulseInput[];
  /** Preview mode: render faux labeled color boxes instead of real assets (no producers run). Default false. */
  test?: boolean;
  /** Per-tile faux appearance for `test` mode, keyed by tile name. Default {} (auto colors + names). */
  testTiles?: Record<string, FauxTileInput>;
}

/** One precomputed color in a palette-reel (the generator builds these from the friendly options). */
export interface ReelItem {
  /** Color display name (already cased per `uppercase`). */
  name: string;
  /** Swatch background hex (`#RRGGBB`). */
  hex: string;
  /** Contrast-picked text color for this band. */
  textColor: string;
  /** Preformatted detail lines revealed on expand (hex / oklch / rgb …). */
  details: string[];
}

export interface PaletteReelSceneOptionsInput {
  /** Precomputed colors to reveal (at least one). */
  items: ReelItem[];
  /** Sliver arrangement. Default "rows". */
  orientation?: "rows" | "columns";
  /** How long each color stays fully open before handing off (s). Default 2. */
  holdSeconds?: number;
  /** Crossfade length from one open color to the next (s). Default 0.7. */
  transitionSeconds?: number;
  /** Ping-pong the sweep so every handoff is between neighbours (no last→first pinch at the seam). Default true. */
  bounce?: boolean;
  /** Easing applied to the crossfade. Default "ease-in-out". */
  easing?: WallEasing;
  /** How many times a sliver's share a fully-open band takes. Default 12. */
  grownFlex?: number;
  /** Minimum cross-size of a sliver in px. Default 0 (derive from the frame size). */
  minCrossPx?: number;
  /** Keep the name visible even in a collapsed sliver. Default true. */
  nameAlwaysVisible?: boolean;
  /** Label font weight. Default 700. */
  fontWeight?: number;
  /** Name font size in px (omit to derive from the frame size). */
  fontSize?: number;
  /** Detail-line font size as a fraction of the name size. Default 0.62. */
  detailFontScale?: number;
  /** Gap between bands (px). Default 0 (bands abut). */
  gap?: number;
  /** Band corner radius (px). Default 0 (square). */
  cornerRadius?: number;
}

/** One eased sweep of an effect across the icon grid — the icon scene's motion primitive. */
export interface IconEffectInput {
  /** What to animate: scale, color, opacity, rotate (to an angle), or spin (full turns). */
  kind: "scale" | "color" | "opacity" | "rotate" | "spin";
  /** When the step starts, as a fraction of the clip (0..1). */
  at: number;
  /** How long the step lasts, as a fraction of the clip (0..1). */
  span: number;
  /** Sweep order across the grid (each icon's phase). Default "forward". */
  order?:
    | "forward"
    | "reverse"
    | "random"
    | "rows"
    | "columns"
    | "diagonal"
    | "radial-in"
    | "radial-out"
    | "spiral";
  /** How much of `span` the phase spreads over: 0 = all at once (a pattern), 1 = one-at-a-time. Default 0.6. */
  stagger?: number;
  /** Which icons participate ('all' or a pattern). Default "all". */
  targets?: "all" | "even" | "odd" | "checkerboard" | "rows-alt" | "cols-alt";
  /** Easing of each icon's ramp. Default "ease-in-out". */
  easing?: WallEasing;
  /** Bounce back to base by the end of the icon's slice (true) or latch at the target (false). Default true. */
  return?: boolean;
  /** Fraction of each icon's slice held at the peak before returning (0..1). Default 0.3. */
  hold?: number;
  /** Scales the effect's strength (0..1). Default 1. */
  intensity?: number;
  /** scale: target size multiplier (1 = base). Default 1.6. */
  scale?: number;
  /** color: target colour (any hex or rgb()). */
  color?: string;
  /** opacity: target opacity (0..1). Default 1. */
  opacity?: number;
  /** rotate: target angle in degrees. Default 90. */
  angle?: number;
  /** spin: full turns over the icon's slice. Default 1. */
  turns?: number;
}

export interface IconsSceneOptionsInput {
  /** Ordered served-file slot names for the icons (the generator populates the matching `files`). */
  icons: string[];
  /** Fixed column count. Omit to auto-pick a near-square grid from the count + frame aspect. */
  columns?: number;
  /** Gap between icons (px). Default 32. */
  gap?: number;
  /** Padding around the grid (px). Default 64. */
  padding?: number;
  /** Icon cell size (px). Omit to fit the grid to the frame. */
  iconSize?: number;
  /** Backdrop behind the grid. Defaults to the scene's `background`. */
  background?: string;
  /** Tint icons via a CSS mask (recolourable). False renders them natively (original colours). Default true. */
  recolor?: boolean;
  /** Resting icon colour (tint mode). Default "#f4f4f5". */
  baseColor?: string;
  /** Resting icon scale multiplier. Default 1. */
  baseScale?: number;
  /** Resting icon opacity (0..1). Default 1. */
  baseOpacity?: number;
  /** The animation: an ordered list of effect steps (folded in order). Default none. */
  steps?: IconEffectInput[];
  /** Seed for `random` sweep orders — same seed ⇒ identical animation. Default 1. */
  seed?: number;
}

// Compile-time guards: the documented authoring types must stay in sync with the schemas.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _wallInSync: Exact<WallSceneOptionsInput, z.input<typeof wallSceneOptionsSchema>> = true;
const _paletteReelInSync: Exact<
  PaletteReelSceneOptionsInput,
  z.input<typeof paletteReelSceneOptionsSchema>
> = true;
const _iconEffectInSync: Exact<IconEffectInput, z.input<typeof iconEffectSchema>> = true;
const _iconsInSync: Exact<IconsSceneOptionsInput, z.input<typeof iconsSceneOptionsSchema>> = true;
void _wallInSync;
void _paletteReelInSync;
void _iconEffectInSync;
void _iconsInSync;
