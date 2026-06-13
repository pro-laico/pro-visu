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

/** Scene id → its sceneOptions validator. The single source of truth for known scenes. */
export const SCENE_OPTION_SCHEMAS = {
  phone: phoneSceneOptionsSchema,
  laptop: laptopSceneOptionsSchema,
  browser: browserSceneOptionsSchema,
  specimen: specimenSceneOptionsSchema,
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

// Compile-time guards: the documented authoring types must stay in sync with the schemas.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _phoneInSync: Exact<PhoneSceneOptionsInput, z.input<typeof phoneSceneOptionsSchema>> = true;
const _laptopInSync: Exact<LaptopSceneOptionsInput, z.input<typeof laptopSceneOptionsSchema>> = true;
const _browserInSync: Exact<BrowserSceneOptionsInput, z.input<typeof browserSceneOptionsSchema>> =
  true;
void _phoneInSync;
void _laptopInSync;
void _browserInSync;
