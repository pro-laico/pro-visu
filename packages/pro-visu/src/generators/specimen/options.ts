import { z } from "zod";

/**
 * A "pulse" is one beat of the specimen's animation: a named span of time during which some
 * fraction of the glyph cells change letter and/or color. An empty pulse (no changes) is a hold.
 * Compose a sequence of pulses to author the whole clip — varying each one's length, change
 * fractions, and pacing gives every beat its own feel. The clip length is the sum of the durations.
 */
export const pulseSchema = z
  .object({
    /** Human label for the beat, e.g. "color sweep" — purely to keep the config readable. */
    name: z
      .string()
      .default("")
      .describe('Human label for the beat, e.g. "color sweep" — purely to keep the config readable.'),
    /** Length of this beat, in seconds. */
    duration: z.number().positive().describe("Length of this beat, in seconds."),
    /** Fraction of cells whose glyph changes during this beat (0..1; 1 = every cell once). */
    chars: z
      .number()
      .nonnegative()
      .default(0)
      .describe("Fraction of cells whose glyph changes during this beat (0..1; 1 = every cell once; 0 = a hold). Default 0."),
    /** Fraction of cells whose color changes during this beat (0..1; 1 = every cell once). */
    colors: z
      .number()
      .nonnegative()
      .default(0)
      .describe("Fraction of cells whose color changes during this beat (0..1; 1 = every cell once). Default 0."),
    /**
     * Target color for this beat's color changes. When set, every color change in the beat goes to
     * this exact token (a deliberate sweep) instead of a weighted-random pick. Set `colors: 1` with
     * `pacing: "even"` to wash the whole specimen to one color evenly. Omit for the default
     * scattered, weighted-random recoloring.
     */
    color: z
      .enum(["foreground", "muted", "accent"])
      .optional()
      .describe("Target color token for this beat's color changes (a deliberate sweep); omit for the default weighted-random recoloring."),
    /**
     * How the changes are distributed in time across the beat — like a CSS easing curve:
     * "linear"/"even" = uniform, "ease-in" = front-loaded, "ease-out" = back-loaded,
     * "ease-in-out" = bunched at both ends, "random" = scattered.
     */
    pacing: z
      .enum(["even", "linear", "ease-in", "ease-out", "ease-in-out", "random"])
      .default("even")
      .describe("How changes are distributed in time across the beat (CSS-easing-like): even/linear, ease-in, ease-out, ease-in-out, random. Default even."),
  })
  .strict();

export type Pulse = z.infer<typeof pulseSchema>;

/** One "pulse" (beat) of the animation storyboard. */
export interface PulseInput {
  /** Human label for the beat, e.g. "color sweep" — purely to keep the config readable. */
  name?: string;
  /** Length of this beat, in seconds. */
  duration: number;
  /** Fraction of cells whose glyph changes during this beat (0..1; 1 = every cell once; 0 = a hold). */
  chars?: number;
  /** Fraction of cells whose color changes during this beat (0..1; 1 = every cell once). */
  colors?: number;
  /**
   * Target color for this beat's color changes. When set, every color change goes to this exact
   * token (a deliberate sweep) rather than a weighted-random pick. Set `colors: 1` with
   * `pacing: "even"` to evenly wash the whole specimen to one color. Omit for the default
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
  /** Display name shown bottom-left (e.g. "ABC Oracle"). Default none. */
  name?: string;
  /** Demo mode: overlay the active pulse's name bottom-right, to see which beat is playing. Default false. */
  demo?: boolean;
  /** Output frames per second. Default 30. */
  fps?: number;
  /** Clip length in seconds. Defaults to the (mirrored) sum of the pulse durations; set to override. */
  durationSeconds?: number;
  /** Output frame width in px. Default 1920. */
  width?: number;
  /** Output frame height in px. Default 1080. */
  height?: number;
  /** Render scale (1 = 1:1; higher = crisper capture, downscaled into the video). Default 1. */
  deviceScaleFactor?: number;
  /** Glyph weight on the variable-font axis, 1–1000. Default 820. */
  weight?: number;
  /** Number of glyph rows. The glyph size is derived so the rows fill the top 80% of the frame. Default 3. */
  lines?: number;
  /** Line-height of the glyph block. Default 0.78 (tight, cap-height-hugging). */
  leading?: number;
  /** Glyphs to exclude from the showcase, e.g. "QXZ" (case-insensitive). Default none. */
  blacklist?: string;
  /** Override the glyph pool the specimen draws from (≥2 distinct characters). Default A–Z 0–9 + symbols. */
  characterPool?: string;
  /** Schedule seed — same seed ⇒ identical animation. Change for a different (still deterministic) take. Default 1. */
  seed?: number;
  /** Color tokens the glyphs cycle through. Override any subset. Default: light-grey palette. */
  colors?: SpecimenColorsInput;
  /** Relative likelihood of each color token on a random (non-targeted) color change. Default 2 / 2 / 1. */
  colorWeights?: SpecimenColorWeightsInput;
  /** The animation storyboard: an ordered sequence of pulses (beats). Default: a lively built-in storyboard. */
  pulses?: PulseInput[];
  /** Multiply every pulse's glyph-change fraction (1 = baseline, 2 = twice as busy, 0 = none). Default 1. */
  characterIntensity?: number;
  /** Multiply every pulse's color-change fraction (1 = baseline, 2 = twice as busy, 0 = none). Default 1. */
  colorIntensity?: number;
  /**
   * Max fraction a line's total width may drift as its glyphs change. Default 0.05. Glyph swaps are
   * width-compensated to stay within this, so the left-aligned right edge barely moves.
   */
  maxLineDrift?: number;
  /**
   * Mirror the pulses (play them out and back) so the clip ends on its opening frame and loops
   * seamlessly. Doubles the clip length. Set false for a one-shot that ends on the last state. Default true.
   */
  mirror?: boolean;
  /** x264 quality, 0–51 (lower = better quality / larger file). Default 18. */
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
 * A lively default storyboard describing the *outward* half of the loop (sums to ~10s). With
 * mirroring on (the default), the clip plays this out and back for a seamless ~20s loop. The
 * `chars`/`colors` numbers are fractions of the wall (1 = every glyph). Override `pulses` to compose
 * your own.
 */
const DEFAULT_PULSES: Pulse[] = [
  P("intro hold", 0.8),
  P("first letters", 0.8, 0.15, 0),
  P("settle", 1.5),
  P("ripple", 1, 0.08, 0.04),
  P("color sweep", 1.2, 0, 0.13),
  P("rest", 1.2),
  P("quick burst", 0.6, 0.18, 0),
  P("drift", 1.2, 0, 0.08),
  P("finale", 1.2, 0.18, 0.13),
  P("outro hold", 0.5),
];

/**
 * The "demo" template: turns on demo mode and walks through each pulse behavior one at a time —
 * every easing curve, a color sweep, and a mingle — each held for 5s with a 2s no-change rest
 * between, and clearly named, so (with demo mode) you can see exactly what each does. Runs once
 * forward (no mirror) for a focused ~47s walkthrough.
 */
const DEMO_PULSES: PulseInput[] = [
  { name: "linear", duration: 5, chars: 0.5, pacing: "linear" },
  { name: "hold", duration: 2 },
  { name: "ease-in", duration: 5, chars: 0.5, pacing: "ease-in" },
  { name: "hold", duration: 2 },
  { name: "ease-out", duration: 5, chars: 0.5, pacing: "ease-out" },
  { name: "hold", duration: 2 },
  { name: "ease-in-out", duration: 5, chars: 0.5, pacing: "ease-in-out" },
  { name: "hold", duration: 2 },
  { name: "random", duration: 5, chars: 0.5, pacing: "random" },
  { name: "hold", duration: 2 },
  // Even, per-character color sweeps: each washes every glyph to one token, evenly across the beat.
  { name: "sweep → muted", duration: 4, colors: 1, color: "muted", pacing: "even" },
  { name: "sweep → accent", duration: 4, colors: 1, color: "accent", pacing: "even" },
  { name: "sweep → foreground", duration: 4, colors: 1, color: "foreground", pacing: "even" },
  { name: "hold", duration: 2 },
  { name: "weighted recolor", duration: 5, colors: 0.6 },
  { name: "hold", duration: 2 },
  { name: "mingle", duration: 5, chars: 0.3, colors: 0.3 },
];

/**
 * The "sweep" template: a clean, seamless-looping showcase built around the even per-character color
 * sweeps. Every glyph washes evenly from one token to the next (muted → accent → foreground), with a
 * touch of glyph drift for life, on a dark palette chosen so the accent reads clearly. Mirrored, so
 * it loops without a seam. Override `colors`, `lines`, or `pulses` to retheme it.
 */
const SWEEP_COLORS: SpecimenColorsInput = {
  background: "#0b0b0f",
  foreground: "#f4f4f5",
  muted: "#6b7280",
  accent: "#7c9cff",
};

// `colors: 1` per sweep lands on every glyph exactly once (one full, clump-free wash). Outward half
// sums to ~10.6s → ~21s mirrored loop.
const SWEEP_PULSES: PulseInput[] = [
  { name: "hold", duration: 0.8 },
  { name: "to muted", duration: 2.2, colors: 1, color: "muted", pacing: "ease-in-out" },
  { name: "settle", duration: 0.6 },
  { name: "to accent", duration: 2.2, colors: 1, color: "accent", pacing: "ease-in-out" },
  { name: "settle", duration: 0.6 },
  { name: "to foreground", duration: 2.2, colors: 1, color: "foreground", pacing: "ease-in-out" },
  { name: "glyph drift", duration: 1.4, chars: 0.5, pacing: "even" },
  { name: "hold", duration: 0.6 },
];

/** Named option presets. Selected via the `template` option; explicit options override them. */
const SPECIMEN_TEMPLATES: Record<SpecimenTemplate, Partial<SpecimenOptionsInput>> = {
  demo: { demo: true, mirror: false, lines: 4, pulses: DEMO_PULSES },
  sweep: {
    mirror: true,
    lines: 4,
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
 * (1920×1080 by default) of the typeface set as a fixed number of left-aligned `lines` (sized to
 * fill the top 80% of the frame) whose glyphs and colors change over a composed sequence of
 * "pulses" (mirrored into a seamless loop by default), and captures it. Everything else has
 * sensible defaults.
 */
const specimenObjectSchema = z
  .object({
    font: z
      .string()
      .min(1)
      .describe("Font file to showcase (path relative to the working dir, or absolute). Required."),
    template: z
      .enum(["demo", "sweep"])
      .optional()
      .describe("Load a named option preset (demo or sweep); your explicit options still override what it sets."),
    name: z
      .string()
      .default("")
      .describe('Display name shown bottom-left (e.g. "ABC Oracle"). Default none.'),
    demo: z
      .boolean()
      .default(false)
      .describe("Demo mode: overlay the active pulse's name bottom-right, to see which beat is playing. Default false."),
    fps: z
      .number()
      .int()
      .positive()
      .max(120)
      .default(30)
      .describe("Output frames per second. Default 30."),
    durationSeconds: z
      .number()
      .positive()
      .optional()
      .describe("Clip length in seconds. Defaults to the (mirrored) sum of the pulse durations; set to override."),
    width: z
      .number()
      .int()
      .positive()
      .default(1920)
      .describe("Output frame width in px. Default 1920."),
    height: z
      .number()
      .int()
      .positive()
      .default(1080)
      .describe("Output frame height in px. Default 1080."),
    deviceScaleFactor: z
      .number()
      .positive()
      .max(4)
      .default(1)
      .describe("Render scale (1 = 1:1; higher = crisper capture, downscaled into the video). Default 1."),
    weight: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(820)
      .describe("Glyph weight on the variable-font axis, 1–1000. Default 820."),
    lines: z
      .number()
      .int()
      .min(1)
      .max(40)
      .default(3)
      .describe("Number of glyph rows; glyph size is derived so rows fill the top 80% of the frame. Default 3."),
    leading: z
      .number()
      .positive()
      .default(0.78)
      .describe("Line-height of the glyph block. Default 0.78 (tight, cap-height-hugging)."),
    blacklist: z
      .string()
      .default("")
      .describe('Glyphs to exclude from the showcase, e.g. "QXZ" (case-insensitive). Default none.'),
    characterPool: z
      .string()
      .refine((s) => new Set([...s.trim()]).size >= 2, "characterPool needs ≥2 distinct characters")
      .optional()
      .describe("Override the glyph pool the specimen draws from (≥2 distinct characters). Default A–Z 0–9 + symbols."),
    seed: z
      .number()
      .int()
      .default(1)
      .describe("Schedule seed — same seed ⇒ identical animation. Change for a different deterministic take. Default 1."),
    colors: z
      .object({
        background: z
          .string()
          .default("#eceef1")
          .describe("Backdrop behind the glyphs."),
        foreground: z
          .string()
          .default("#16181d")
          .describe("Primary glyph color — the resting majority."),
        muted: z
          .string()
          .default("#a7adb6")
          .describe("Muted/secondary glyph color."),
        accent: z
          .string()
          .optional()
          .describe("Accent color for occasional pops; defaults to `background` (accent glyphs blend in) if unset."), // defaults to `background` at render (accent glyphs blend in)
        label: z
          .string()
          .optional()
          .describe("Color of the font-name label (bottom corner); defaults to `foreground` if unset."), // defaults to `foreground` at render
      })
      .default({})
      .describe("Color tokens the glyphs cycle through (any CSS colors). Override any subset. Default: light-grey palette."),
    colorWeights: z
      .object({
        foreground: z
          .number()
          .nonnegative()
          .default(2)
          .describe("Relative likelihood of the foreground token on a random color change. Default 2."),
        muted: z
          .number()
          .nonnegative()
          .default(2)
          .describe("Relative likelihood of the muted token on a random color change. Default 2."),
        accent: z
          .number()
          .nonnegative()
          .default(1)
          .describe("Relative likelihood of the accent token on a random color change. Default 1."),
      })
      .default({})
      .describe("Relative likelihood of each color token on a random (non-targeted) color change. Default 2 / 2 / 1."),
    pulses: z
      .array(pulseSchema)
      .min(1)
      .default(DEFAULT_PULSES)
      .describe("The animation storyboard: an ordered sequence of pulses (beats). Default: a lively built-in storyboard."),
    characterIntensity: z
      .number()
      .nonnegative()
      .default(1)
      .describe("Multiply every pulse's glyph-change fraction (1 = baseline, 2 = twice as busy, 0 = none). Default 1."),
    colorIntensity: z
      .number()
      .nonnegative()
      .default(1)
      .describe("Multiply every pulse's color-change fraction (1 = baseline, 2 = twice as busy, 0 = none). Default 1."),
    maxLineDrift: z
      .number()
      .positive()
      .max(0.5)
      .default(0.05)
      .describe("Max fraction a line's total width may drift as its glyphs change; swaps are width-compensated. Default 0.05."),
    mirror: z
      .boolean()
      .default(true)
      .describe("Mirror the pulses (play out and back) for a seamless loop; doubles the clip length. Default true."),
    crf: z
      .number()
      .int()
      .min(0)
      .max(51)
      .default(18)
      .describe("x264 quality, 0–51 (lower = better quality / larger file). Default 18."),
    fileName: z
      .string()
      .optional()
      .describe('Output filename; defaults to "<slug(asset name)>.mp4".'),
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
