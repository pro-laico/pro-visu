import { z } from "zod";
import { pulseSchema } from "@/generators/specimen/options";

/**
 * Per-scene `sceneOptions` schemas — the knobs each built-in scene understands. `renderScene`
 * validates against the selected scene's schema before serializing props, so a typo'd key or an
 * unknown scene id fails fast with a named error instead of silently rendering defaults. Every
 * default equals the value the scene previously hardcoded, so existing configs render identically.
 *
 * The author-facing *Input interfaces below mirror each schema's input shape (compile-time-guarded)
 * and flow into `SceneOptions`' discriminated union for editor autocomplete.
 */

export const phoneSceneOptionsSchema = z
  .object({
    /** Bezel (body) color. */
    bezel: z.string().default("#0a0a0a"),
    /** CSS box-shadow under the device ("none" to disable). */
    shadow: z.string().default("0 40px 120px rgba(0,0,0,0.5)"),
    /** Multiplies the computed corner radius (1 = stock). */
    radiusScale: z.number().positive().default(1),
    /** Screen background behind/around the video. */
    screenBackground: z.string().default("#000"),
  })
  .strict();

export const laptopSceneOptionsSchema = z
  .object({
    /** Bezel (body) color. */
    bezel: z.string().default("#16161a"),
    /** CSS box-shadow under the screen ("none" to disable). */
    shadow: z.string().default("0 30px 90px rgba(0,0,0,0.5)"),
    /** Show the hinge notch on the base. */
    hinge: z.boolean().default(true),
    /** Screen background behind/around the video. */
    screenBackground: z.string().default("#000"),
  })
  .strict();

export const browserSceneOptionsSchema = z
  .object({
    /** Window frame color. */
    frame: z.string().default("#1b1b22"),
    /** Address-bar label text (e.g. "yoursite.com"). */
    url: z.string().default(""),
    /** Show the traffic-light dots. */
    dots: z.boolean().default(true),
    /** Traffic-light dot colors (left to right). */
    dotColors: z
      .tuple([z.string(), z.string(), z.string()])
      .default(["#ff5f57", "#febc2e", "#28c840"]),
    /** Title-bar background. */
    barColor: z.string().default("#23232c"),
    /** Address-pill background. */
    addressBarColor: z.string().default("#15151b"),
    /** CSS box-shadow under the window ("none" to disable). */
    shadow: z.string().default("0 40px 110px rgba(0,0,0,0.5)"),
  })
  .strict();

/**
 * The specimen scene's wire format — produced by the specimen *generator* (its friendly options
 * are the real authoring surface), validated here so generator and scene can't drift apart.
 */
export const specimenSceneOptionsSchema = z
  .object({
    label: z.string().default(""),
    demo: z.boolean().default(false),
    weight: z.number().min(1).max(1000).default(820),
    characters: z.number().int().min(1).max(120).default(23),
    fontSize: z.number().positive().optional(),
    blacklist: z.string().default(""),
    colors: z
      .object({
        background: z.string(),
        foreground: z.string(),
        muted: z.string(),
        accent: z.string().optional(),
        label: z.string().optional(),
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
    pulses: z.array(pulseSchema).default([]),
    mirror: z.boolean().default(true),
    characterIntensity: z.number().nonnegative().default(1),
    colorIntensity: z.number().nonnegative().default(1),
    /** Schedule seed — same seed ⇒ identical animation (parallel workers must agree). */
    seed: z.number().int().default(1),
    /** Line-height of the glyph block. */
    leading: z.number().positive().default(0.78),
    /** Glyph pool override (≥2 distinct characters after the blacklist). */
    characterPool: z.string().min(2).optional(),
  })
  .strict();

/**
 * The "wall" scene: a marquee of media tiles (the asset's video/screenshot inputs, cycled across
 * the grid). The whole wall pans on X while each column scrolls on Y at its own seeded, varying
 * speed (columns alternating up/down), looping seamlessly.
 */
export const wallSceneOptionsSchema = z
  .object({
    /** Number of columns (fewer = bigger tiles). */
    columns: z.number().int().min(1).max(12).default(4),
    /** Padding between columns and between their tile contents (px). */
    padding: z.number().nonnegative().default(16),
    /** Tile aspect ratio (width / height); 1.6 = 16:10 landscape, <1 = portrait. */
    tileAspect: z.number().positive().default(1.6),
    /** Tile corner radius (px). */
    cornerRadius: z.number().nonnegative().default(12),
    /** Backdrop shown in the padding gaps and behind tiles. Defaults to the scene's `background`. */
    background: z.string().optional(),
    /** Whole-clip horizontal pan cycles (0 = no pan; 1 = one sweep, delivered via pulses). */
    panLoops: z.number().int().nonnegative().default(1),
    /** Pan direction. */
    panDirection: z.enum(["left", "right"]).default("left"),
    /** Min/max per-column vertical scroll cycles over the clip — the travel range (varies per column). */
    scrollLoopsMin: z.number().int().min(1).default(1),
    scrollLoopsMax: z.number().int().min(1).default(2),
    /** Alternate column scroll direction (up/down) for a livelier wall. */
    alternate: z.boolean().default(true),
    /**
     * The wall is passive (mostly held), moving in brief eased "pulses". `pulses` = how many bursts
     * over the clip; `pulseDuration` = each burst's length in seconds (~1 = a quick one-second move);
     * `baseDrift` = how much constant slow creep between pulses (0 = fully held, 1 = constant linear).
     */
    pulses: z.number().int().min(1).max(20).default(4),
    pulseDuration: z.number().positive().default(1),
    baseDrift: z.number().min(0).max(1).default(0.08),
    /** How much pulse sizes vary (0 = uniform pulses; ~0.6 = organic, some bigger than others). */
    pulseVariance: z.number().min(0).max(1).default(0.6),
    /** Seed for the per-column speed variation — same seed ⇒ identical wall (workers must agree). */
    seed: z.number().int().default(1),
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

export const paletteReelSceneOptionsSchema = z
  .object({
    items: z.array(reelItemSchema).min(1),
    orientation: z.enum(["rows", "columns"]).default("rows"),
    holdSeconds: z.number().positive().default(2),
    transitionSeconds: z.number().positive().default(0.7),
    bounce: z.boolean().default(true),
    easing: z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]).default("ease-in-out"),
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

/** Scene id → its sceneOptions validator. The single source of truth for known scenes. */
export const SCENE_OPTION_SCHEMAS = {
  phone: phoneSceneOptionsSchema,
  laptop: laptopSceneOptionsSchema,
  browser: browserSceneOptionsSchema,
  specimen: specimenSceneOptionsSchema,
  wall: wallSceneOptionsSchema,
  "palette-reel": paletteReelSceneOptionsSchema,
} as const;

export type SceneId = keyof typeof SCENE_OPTION_SCHEMAS;

// ---------------------------------------------------------------------------
// Author-facing input types (editor autocomplete). Kept in sync with the zod
// schemas by the Exact<> guards at the bottom — a drift is a compile error.
// ---------------------------------------------------------------------------

export interface PhoneSceneOptionsInput {
  /** Bezel (body) color. */
  bezel?: string;
  /** CSS box-shadow under the device ("none" to disable). */
  shadow?: string;
  /** Multiplies the computed corner radius (1 = stock). */
  radiusScale?: number;
  /** Screen background behind/around the video. */
  screenBackground?: string;
}

export interface LaptopSceneOptionsInput {
  /** Bezel (body) color. */
  bezel?: string;
  /** CSS box-shadow under the screen ("none" to disable). */
  shadow?: string;
  /** Show the hinge notch on the base. */
  hinge?: boolean;
  /** Screen background behind/around the video. */
  screenBackground?: string;
}

export interface BrowserSceneOptionsInput {
  /** Window frame color. */
  frame?: string;
  /** Address-bar label text (e.g. "yoursite.com"). */
  url?: string;
  /** Show the traffic-light dots. */
  dots?: boolean;
  /** Traffic-light dot colors (left to right). */
  dotColors?: [string, string, string];
  /** Title-bar background. */
  barColor?: string;
  /** Address-pill background. */
  addressBarColor?: string;
  /** CSS box-shadow under the window ("none" to disable). */
  shadow?: string;
}

export interface WallSceneOptionsInput {
  /** Number of columns. */
  columns?: number;
  /** Padding between columns and between their tile contents (px). */
  padding?: number;
  /** Tile aspect ratio (width / height); 1.6 = 16:10 landscape. */
  tileAspect?: number;
  /** Tile corner radius (px). */
  cornerRadius?: number;
  /** Backdrop shown in the padding gaps and behind tiles. Defaults to the scene's background. */
  background?: string;
  /** Whole-clip horizontal pan cycles (0 = no pan; 1 = one slow sweep). */
  panLoops?: number;
  /** Pan direction. */
  panDirection?: "left" | "right";
  /** Min per-column vertical scroll cycles over the clip. */
  scrollLoopsMin?: number;
  /** Max per-column vertical scroll cycles over the clip. */
  scrollLoopsMax?: number;
  /** Alternate column scroll direction (up/down). */
  alternate?: boolean;
  /** Number of brief eased motion pulses over the clip (the wall holds between them). */
  pulses?: number;
  /** Each pulse's eased ramp length, in seconds (~1 = a quick one-second move). */
  pulseDuration?: number;
  /** Constant slow creep between pulses: 0 = fully held, 1 = constant linear motion. */
  baseDrift?: number;
  /** How much pulse sizes vary (0 = uniform; ~0.6 = organic, some bigger than others). */
  pulseVariance?: number;
  /** Seed for the per-column speed variation. */
  seed?: number;
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
  /** Precomputed colors to reveal. */
  items: ReelItem[];
  /** Sliver arrangement. */
  orientation?: "rows" | "columns";
  /** How long each color stays fully open before handing off (s). */
  holdSeconds?: number;
  /** Crossfade length from one open color to the next (s). */
  transitionSeconds?: number;
  /** Ping-pong the sweep so every handoff is between neighbours (no last→first pinch at the seam). */
  bounce?: boolean;
  /** Easing applied to the crossfade. */
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  /** How many times a sliver's share a fully-open band takes. */
  grownFlex?: number;
  /** Minimum cross-size of a sliver in px (0 = derive). */
  minCrossPx?: number;
  /** Keep the name visible even in a collapsed sliver. */
  nameAlwaysVisible?: boolean;
  /** Label font weight. */
  fontWeight?: number;
  /** Name font size in px (omit to derive from the frame size). */
  fontSize?: number;
  /** Detail-line font size as a fraction of the name size. */
  detailFontScale?: number;
  /** Gap between bands (px). */
  gap?: number;
  /** Band corner radius (px). */
  cornerRadius?: number;
}

// Compile-time guards: the documented authoring types must stay in sync with the schemas.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _phoneInSync: Exact<PhoneSceneOptionsInput, z.input<typeof phoneSceneOptionsSchema>> = true;
const _laptopInSync: Exact<LaptopSceneOptionsInput, z.input<typeof laptopSceneOptionsSchema>> = true;
const _browserInSync: Exact<BrowserSceneOptionsInput, z.input<typeof browserSceneOptionsSchema>> =
  true;
const _wallInSync: Exact<WallSceneOptionsInput, z.input<typeof wallSceneOptionsSchema>> = true;
const _paletteReelInSync: Exact<
  PaletteReelSceneOptionsInput,
  z.input<typeof paletteReelSceneOptionsSchema>
> = true;
void _phoneInSync;
void _laptopInSync;
void _browserInSync;
void _wallInSync;
void _paletteReelInSync;
