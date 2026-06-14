import { z } from "zod";

/**
 * A "pulse" is one beat of the specimen's animation: a named span of time during which some
 * number of glyph and/or color changes happen. An empty pulse (no changes) is a hold. Compose a
 * sequence of pulses to author the whole clip — varying each one's length, change counts, and
 * pacing gives every beat its own feel. The clip length is the sum of the pulse durations.
 */
export const pulseSchema = z
  .object({
    /** Human label for the beat, e.g. "color sweep" — purely to keep the config readable. */
    name: z.string().default(""),
    /** Length of this beat, in seconds. */
    duration: z.number().positive(),
    /** How many glyph changes happen during this beat (0 = none). */
    chars: z.number().int().nonnegative().default(0),
    /** How many color changes happen during this beat (0 = none). */
    colors: z.number().int().nonnegative().default(0),
    /**
     * Target color for this beat's color changes. When set, every color change in the beat goes to
     * this exact token (a deliberate sweep) instead of a weighted-random pick. Set `colors` ≥ the
     * glyph count and `pacing: "even"` to wash the whole specimen to one color evenly. Omit for the
     * default scattered, weighted-random recoloring.
     */
    color: z.enum(["foreground", "muted", "accent"]).optional(),
    /**
     * How the changes are distributed in time across the beat — like a CSS easing curve:
     * "linear"/"even" = uniform, "ease-in" = front-loaded, "ease-out" = back-loaded,
     * "ease-in-out" = bunched at both ends, "random" = scattered.
     */
    pacing: z
      .enum(["even", "linear", "ease-in", "ease-out", "ease-in-out", "random"])
      .default("even"),
  })
  .strict();

export type Pulse = z.infer<typeof pulseSchema>;

/** One "pulse" (beat) of the animation storyboard. */
export interface PulseInput {
  /** Human label for the beat, e.g. "color sweep" — purely to keep the config readable. */
  name?: string;
  /** Length of this beat, in seconds. */
  duration: number;
  /** How many glyph changes happen during this beat (0 = none — a hold). */
  chars?: number;
  /** How many color changes happen during this beat (0 = none). */
  colors?: number;
  /**
   * Target color for this beat's color changes. When set, every color change goes to this exact
   * token (a deliberate sweep) rather than a weighted-random pick. Set `colors` ≥ the glyph count
   * with `pacing: "even"` to evenly wash the whole specimen to one color. Omit for the default
   * scattered, weighted-random recoloring.
   */
  color?: "foreground" | "muted" | "accent";
  /**
   * How the changes are distributed in time across the beat — like a CSS easing curve:
   * "linear"/"even" = uniform, "ease-in" = front-loaded, "ease-out" = back-loaded,
   * "ease-in-out" = bunched at both ends, "random" = scattered.
   */
  pacing?: "even" | "linear" | "ease-in" | "ease-out" | "ease-in-out" | "random";
}

/**
 * Relative likelihood each color token is chosen on a (non-targeted) color change. Higher = more
 * frequent. The default keeps foreground/muted common and accent a rare pop (2 / 2 / 1). Set any to
 * 0 to exclude that token from random recoloring (an explicit pulse `color` can still target it).
 */
export interface SpecimenColorWeightsInput {
  foreground?: number;
  muted?: number;
  accent?: number;
}

/** The specimen's color palette (any CSS colors). Override any subset. */
export interface SpecimenColorsInput {
  /** Backdrop behind the glyphs. */
  background?: string;
  /** Primary glyph color — the resting majority. */
  foreground?: string;
  /** Muted/secondary glyph color. */
  muted?: string;
  /** Accent color for occasional pops; defaults to `background` (accent glyphs blend in) if unset. */
  accent?: string;
  /** Color of the font-name label (bottom corner); defaults to `foreground` if unset. */
  label?: string;
}

/** A named option preset. The keys here are the selectable `template` values. */
export type SpecimenTemplate = "demo" | "sweep";

/**
 * Author-facing options for the `specimen` generator — a looping type-specimen video. Only `font`
 * is required; everything else has a sensible default.
 */
export interface SpecimenOptionsInput {
  /** Font file to showcase (path relative to the working dir, or absolute). Required. */
  font: string;
  /**
   * Load a named option preset; your explicit options below still override what it sets. Options:
   * - `"demo"` — labeled walkthrough of every pulse behavior (each easing curve, a color sweep, a
   *   mingle) with demo mode on; runs once, no mirror. Good for seeing what each setting does.
   * - `"sweep"` — seamless-looping showcase of the even per-character color sweeps (muted → accent
   *   → foreground) on a dark palette chosen so the accent reads.
   */
  template?: SpecimenTemplate;
  /** Display name shown bottom-left (e.g. "ABC Oracle"). */
  name?: string;
  /** Demo mode: overlay the active pulse's name bottom-right, to see which beat is playing. */
  demo?: boolean;
  /** Output frames per second. */
  fps?: number;
  /** Clip length in seconds. Defaults to the (mirrored) sum of the pulse durations; set to override. */
  durationSeconds?: number;
  /** Output frame width in px (default 1920). */
  width?: number;
  /** Output frame height in px (default 1080). */
  height?: number;
  /** Render scale (1 = 1:1; higher = crisper capture, downscaled into the video). */
  deviceScaleFactor?: number;
  /** Glyph weight on the variable-font axis, 1–1000. */
  weight?: number;
  /** Roughly how many glyphs to show — auto-grouped into the wrapping line. */
  characters?: number;
  /** Explicit glyph size in px. Omit to auto-fit the type area. */
  fontSize?: number;
  /** Line-height of the glyph block (default 0.78 — tight, cap-height-hugging). */
  leading?: number;
  /** Glyphs to exclude from the showcase, e.g. "QXZ" (case-insensitive). */
  blacklist?: string;
  /** Override the glyph pool the specimen draws from (≥2 distinct characters). Default A–Z 0–9 + symbols. */
  characterPool?: string;
  /** Schedule seed — same seed ⇒ identical animation. Change for a different (still deterministic) take. */
  seed?: number;
  /** Color tokens the glyphs cycle through. Override any subset. */
  colors?: SpecimenColorsInput;
  /** Relative likelihood of each color token on a random (non-targeted) color change (default 2/2/1). */
  colorWeights?: SpecimenColorWeightsInput;
  /** The animation storyboard: an ordered sequence of pulses (beats). */
  pulses?: PulseInput[];
  /** Multiply every pulse's glyph-change count (1 = baseline, 2 = twice as busy, 0 = none). */
  characterIntensity?: number;
  /** Multiply every pulse's color-change count (1 = baseline, 2 = twice as busy, 0 = none). */
  colorIntensity?: number;
  /**
   * Mirror the pulses (play them out and back) so the clip ends on its opening frame and loops
   * seamlessly. Doubles the clip length. Set false for a one-shot that ends on the last state.
   */
  mirror?: boolean;
  /** x264 quality, 0–51 (lower = better quality / larger file). */
  crf?: number;
  /** Output filename; defaults to "<slug(asset name)>.mp4". */
  fileName?: string;
}

const P = (name: string, duration: number, chars = 0, colors = 0): Pulse => ({
  name,
  duration,
  chars,
  colors,
  pacing: "even",
});

/**
 * A lively default storyboard describing the *outward* half of the loop (sums to 10s). With
 * mirroring on (the default), the clip plays this out and back for a seamless ~20s loop. Override
 * `pulses` in config to compose your own.
 */
const DEFAULT_PULSES: Pulse[] = [
  P("intro hold", 0.8),
  P("first letters", 0.8, 3, 0),
  P("settle", 1.5),
  P("ripple", 1, 2, 1),
  P("color sweep", 1.2, 0, 3),
  P("rest", 1.2),
  P("quick burst", 0.6, 4, 0),
  P("drift", 1.2, 0, 2),
  P("finale", 1.2, 4, 3),
  P("outro hold", 0.5),
];

/**
 * The "demo" template: turns on demo mode and walks through each pulse behavior one at a time —
 * every easing curve, a color sweep, and a mingle — each held for 5s with a 2s no-change rest
 * between, and clearly named, so (with demo mode) you can see exactly what each does. Runs once
 * forward (no mirror) for a focused ~47s walkthrough.
 */
const DEMO_CHARACTERS = 27;
const DEMO_PULSES: PulseInput[] = [
  { name: "linear", duration: 5, chars: 15, pacing: "linear" },
  { name: "hold", duration: 2 },
  { name: "ease-in", duration: 5, chars: 15, pacing: "ease-in" },
  { name: "hold", duration: 2 },
  { name: "ease-out", duration: 5, chars: 15, pacing: "ease-out" },
  { name: "hold", duration: 2 },
  { name: "ease-in-out", duration: 5, chars: 15, pacing: "ease-in-out" },
  { name: "hold", duration: 2 },
  { name: "random", duration: 5, chars: 15, pacing: "random" },
  { name: "hold", duration: 2 },
  // Even, per-character color sweeps: each washes every glyph to one token, evenly across the beat.
  { name: "sweep → muted", duration: 4, colors: DEMO_CHARACTERS, color: "muted", pacing: "even" },
  { name: "sweep → accent", duration: 4, colors: DEMO_CHARACTERS, color: "accent", pacing: "even" },
  { name: "sweep → foreground", duration: 4, colors: DEMO_CHARACTERS, color: "foreground", pacing: "even" },
  { name: "hold", duration: 2 },
  { name: "weighted recolor", duration: 5, colors: 16 },
  { name: "hold", duration: 2 },
  { name: "mingle", duration: 5, chars: 8, colors: 8 },
];

/**
 * The "sweep" template: a clean, seamless-looping showcase built around the even per-character color
 * sweeps. Every glyph washes evenly from one token to the next (muted → accent → foreground), with a
 * touch of glyph drift for life, on a dark palette chosen so the accent reads clearly. Mirrored, so
 * it loops without a seam. Override `colors`, `characters`, or `pulses` to retheme it.
 */
const SWEEP_COLORS: SpecimenColorsInput = {
  background: "#0b0b0f",
  foreground: "#f4f4f5",
  muted: "#6b7280",
  accent: "#7c9cff",
};

// `colors` per sweep is kept equal to `characters` so an even sweep lands on every glyph exactly once
// (one full, clump-free wash). Outward half sums to ~10.6s → ~21s mirrored loop.
const SWEEP_CHARACTERS = 26;
const SWEEP_PULSES: PulseInput[] = [
  { name: "hold", duration: 0.8 },
  { name: "to muted", duration: 2.2, colors: SWEEP_CHARACTERS, color: "muted", pacing: "ease-in-out" },
  { name: "settle", duration: 0.6 },
  { name: "to accent", duration: 2.2, colors: SWEEP_CHARACTERS, color: "accent", pacing: "ease-in-out" },
  { name: "settle", duration: 0.6 },
  { name: "to foreground", duration: 2.2, colors: SWEEP_CHARACTERS, color: "foreground", pacing: "ease-in-out" },
  { name: "glyph drift", duration: 1.4, chars: 13, pacing: "even" },
  { name: "hold", duration: 0.6 },
];

/** Named option presets. Selected via the `template` option; explicit options override them. */
const SPECIMEN_TEMPLATES: Record<SpecimenTemplate, Partial<SpecimenOptionsInput>> = {
  demo: { demo: true, mirror: false, characters: DEMO_CHARACTERS, pulses: DEMO_PULSES },
  sweep: {
    mirror: true,
    characters: SWEEP_CHARACTERS,
    colors: SWEEP_COLORS,
    pulses: SWEEP_PULSES,
  },
};

/** Merge a selected template underneath the user's explicit options (which win). */
function applyTemplate(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  const tmpl =
    typeof r.template === "string"
      ? SPECIMEN_TEMPLATES[r.template as SpecimenTemplate]
      : undefined;
  return tmpl ? { ...tmpl, ...r } : raw;
}

/**
 * A type-specimen video: point it at a font file and give it a name — the tool renders a clip
 * (1920×1080 by default) of the typeface set as a wrapping string whose glyphs and colors change
 * over a composed sequence of "pulses" (mirrored into a seamless loop by default), and captures it.
 * Everything else has sensible defaults.
 */
const specimenObjectSchema = z
  .object({
    font: z.string().min(1),
    template: z.enum(["demo", "sweep"]).optional(),
    name: z.string().default(""),
    demo: z.boolean().default(false),
    fps: z.number().int().positive().max(120).default(30),
    durationSeconds: z.number().positive().optional(),
    width: z.number().int().positive().default(1920),
    height: z.number().int().positive().default(1080),
    deviceScaleFactor: z.number().positive().max(4).default(1),
    weight: z.number().int().min(1).max(1000).default(820),
    characters: z.number().int().min(1).max(120).default(23),
    fontSize: z.number().positive().optional(),
    leading: z.number().positive().default(0.78),
    blacklist: z.string().default(""),
    characterPool: z
      .string()
      .refine((s) => new Set([...s.trim()]).size >= 2, "characterPool needs ≥2 distinct characters")
      .optional(),
    seed: z.number().int().default(1),
    colors: z
      .object({
        background: z.string().default("#eceef1"),
        foreground: z.string().default("#16181d"),
        muted: z.string().default("#a7adb6"),
        accent: z.string().optional(), // defaults to `background` at render (accent glyphs blend in)
        label: z.string().optional(), // defaults to `foreground` at render
      })
      .default({}),
    colorWeights: z
      .object({
        foreground: z.number().nonnegative().default(2),
        muted: z.number().nonnegative().default(2),
        accent: z.number().nonnegative().default(1),
      })
      .default({}),
    pulses: z.array(pulseSchema).min(1).default(DEFAULT_PULSES),
    characterIntensity: z.number().nonnegative().default(1),
    colorIntensity: z.number().nonnegative().default(1),
    mirror: z.boolean().default(true),
    crf: z.number().int().min(0).max(51).default(18),
    fileName: z.string().optional(),
  })
  .strict();

/** Runtime validator: expands the selected `template`, then validates the merged options. */
export const specimenOptionsSchema = z.preprocess(applyTemplate, specimenObjectSchema);

/** Author-facing input (documented for editor hover; the schema above validates it at run time). */
export type SpecimenOptions = SpecimenOptionsInput;
/** Fully-resolved options after parsing. */
export type ResolvedSpecimenOptions = z.infer<typeof specimenObjectSchema>;

// Compile-time guard: the documented authoring type must stay in sync with the schema's input shape.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _specimenInputInSync: Exact<SpecimenOptionsInput, z.input<typeof specimenObjectSchema>> = true;
void _specimenInputInSync;
