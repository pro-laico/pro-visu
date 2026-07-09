import { z } from "zod";

import { videoOutputShape } from "@/generators/shared-options";
import { iconEffectSchema, type IconEffectInput } from "@/scene-engine/scene-options";

/**
 * Author-facing options for the `icons` generator — a showcase of a project's icon set: a centred
 * grid of uniform icons on a solid backdrop, animated by a list of "effect steps" and output as a
 * looping video (mp4) or a single still (png).
 *
 * You supply uniform, single-colour icons (SVG or PNG); by default each is TINTED via a CSS mask so
 * it can be recoloured live (that's what the recolour interactions animate). Every preset
 * interaction — "scale one at a time", "recolour one at a time", "recolour many in a pattern",
 * ripples, spins — is the SAME step primitive (see `steps` / {@link IconEffectInput}) with a
 * different `order`/`stagger`, so you can compose your own creative sequences by stacking steps.
 */

/** Re-exported so a config can type a single effect step. */
export type { IconEffectInput };

/** A single icon source: a path, or `{ src }`. */
export type IconSourceInput =
  | string
  | {
      /** Path to a local icon file (SVG or PNG, relative to the working dir, or absolute). */
      src: string;
    };

const iconSourceSchema = z.union([
  z.string().min(1),
  z.object({ src: z.string().min(1).describe("Path to a local icon file (relative to the working dir, or absolute).") }).strict(),
]);

/** A named option preset. The keys here are the selectable `template` values. */
export type IconsTemplate = "showcase" | "scale-sweep" | "color-sweep" | "ripple" | "pattern";

/** Output frame + encoding settings. Override any subset. */
export interface IconsOutputInput {
  /** Emit a looping video ("video", mp4) or a single still frame ("image", png). Default "video". */
  format?: "video" | "image";
  /** Output frame width in px. Default 1080. */
  width?: number;
  /** Output frame height in px. Default 1080. */
  height?: number;
  /** Render scale (higher = crisper capture, downscaled into the output). Default 2. */
  deviceScaleFactor?: number;
  /** Output frames per second (video). Default 30. */
  fps?: number;
  /** x264 quality, 0–51 (lower = better quality / larger file) (video). Default 18. */
  crf?: number;
  /** Parallel render workers (video). Omit to auto-pick from cores + free memory. */
  workers?: number;
  /** Output filename; defaults to "<slug(asset name)>.<mp4|png>". */
  fileName?: string;
}

/** The animation timeline: clip length, and where to freeze the still. */
export interface IconsMotionInput {
  /** Clip length in ms — the steps' `at`/`span` (and `posterTime`) are fractions of this. Default 8000. */
  durationMs?: number;
  /** For `output.format: "image"`: which clip moment to freeze, as a fraction of the timeline (0..1). Default 0.5. */
  posterTime?: number;
}

/** Grid layout + appearance. Override any subset. */
export interface IconsLayoutInput {
  /** Fixed column count. Omit to auto-pick a near-square grid from the icon count + frame aspect. */
  columns?: number;
  /** Gap between icons (px). Default 32. */
  gap?: number;
  /** Padding around the grid (px). Default 64. */
  padding?: number;
  /** Icon cell size (px). Omit to fit the grid to the frame. */
  iconSize?: number;
  /** Backdrop behind the grid (any CSS color). Default "#0b0b0f". */
  background?: string;
  /**
   * Tint each icon via a CSS mask so it can be recoloured (shape from the file's alpha). Turn OFF to
   * render icons natively (original colours) — then only scale / opacity / rotate effects apply.
   * Default true.
   */
  recolor?: boolean;
}

/** Resting icon appearance (before any step) + the animation seed. */
export interface IconsBaseInput {
  /** Resting icon colour, tint mode (any CSS color). Default "#f4f4f5". */
  color?: string;
  /** Resting icon scale multiplier. Default 1. */
  scale?: number;
  /** Resting icon opacity (0..1). Default 1. */
  opacity?: number;
  /** Seed for `random` sweep orders — same seed ⇒ identical animation. Default 1. */
  seed?: number;
}

/**
 * Author-facing options for the `icons` generator. Provide the icons (via `icons` and/or `dir`) and,
 * optionally, a `template` or your own `steps`; everything else has a sensible default.
 */
export interface IconsOptionsInput {
  /** Icon sources: an array of paths and/or `{ src }`. Combined with `dir` (dir first, then these). */
  icons?: IconSourceInput[];
  /** A folder whose image files (svg/png/webp/jpg/gif/avif) become the icons, sorted by filename. */
  dir?: string;
  /**
   * Load a named interaction preset; your explicit `steps` (and other options) still override it:
   * - `"showcase"` (default) — a radial scale ripple, then a forward recolour sweep, ending at rest.
   * - `"scale-sweep"` — scale each icon up one at a time, then settle back.
   * - `"color-sweep"` — recolour each icon to the accent one at a time, then back.
   * - `"ripple"` — a scale wave rippling out from the centre.
   * - `"pattern"` — recolour a checkerboard pattern, then the alternate cells.
   */
  template?: IconsTemplate;
  /** Output frame + encoding (format, width, height, deviceScaleFactor, fps, crf, workers, fileName). */
  output?: IconsOutputInput;
  /** Animation timeline: clip length + still sample point (durationMs, posterTime). */
  motion?: IconsMotionInput;
  /** Grid layout + appearance (columns, gap, padding, iconSize, background, recolor). */
  layout?: IconsLayoutInput;
  /** Resting icon appearance + animation seed (color, scale, opacity, seed). */
  base?: IconsBaseInput;
  /** Accent colour used by the recolour templates (any CSS color). Default "#7c9cff". */
  accent?: string;
  /**
   * The animation: an ordered list of effect steps (folded in order, so they layer). Each step
   * sweeps one effect (scale / color / opacity / rotate / spin) across the grid; its `order` +
   * `stagger` decide the pattern (all-at-once → one-at-a-time). Defaults to the `template`'s steps.
   */
  steps?: IconEffectInput[];
}

const ACCENT = "#7c9cff";

/** The steps for a named template, using `accent` for every recolour so the `accent` option flows through. */
function templateSteps(name: IconsTemplate, accent: string): IconEffectInput[] {
  switch (name) {
    case "scale-sweep":
      return [{ kind: "scale", at: 0.05, span: 0.9, order: "forward", stagger: 0.92, scale: 1.6, hold: 0.1 }];
    case "color-sweep":
      return [{ kind: "color", at: 0.05, span: 0.9, order: "forward", stagger: 0.9, color: accent, hold: 0.15 }];
    case "ripple":
      return [
        { kind: "scale", at: 0.05, span: 0.9, order: "radial-out", stagger: 0.8, scale: 1.45, hold: 0.05, easing: "ease-in-out" },
      ];
    case "pattern":
      return [
        { kind: "color", at: 0.05, span: 0.4, order: "forward", stagger: 0, targets: "checkerboard", color: accent, hold: 0.4 },
        { kind: "color", at: 0.5, span: 0.4, order: "forward", stagger: 0, targets: "rows-alt", color: accent, hold: 0.4 },
      ];
    default:
      return [
        { kind: "scale", at: 0.03, span: 0.52, order: "radial-out", stagger: 0.5, scale: 1.4, hold: 0.32 },
        { kind: "color", at: 0.52, span: 0.44, order: "forward", stagger: 0.8, color: accent, hold: 0.25 },
      ];
  }
}

/** Is `v` a plain object we should recurse into (not an array, not null)? */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merge `override` onto `base` (user values win per-field; arrays/primitives replace, nested objects merge). */
function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const b = out[k];
    out[k] = isPlainObject(b) && isPlainObject(v) ? deepMerge(b, v) : v;
  }
  return out;
}

/** Merge a selected template's steps underneath the user's explicit options (which win, deeply). */
function applyTemplate(raw: unknown): unknown {
  if (!isPlainObject(raw)) return raw;
  //EXCUSE: asserts the validated string is a known template name; unknown names are handled by templateSteps
  const name =
    typeof raw.template === "string" ? (raw.template as IconsTemplate) : raw.steps === undefined ? "showcase" : undefined;
  if (!name) return raw;
  const accent = typeof raw.accent === "string" ? raw.accent : ACCENT;
  return deepMerge({ steps: templateSteps(name, accent) }, raw);
}

const iconsObjectSchema = z
  .object({
    icons: z.array(iconSourceSchema).default([]).describe("Icon sources: paths and/or { src }. Combined with `dir` (dir first, then these)."),
    dir: z.string().optional().describe("A folder whose image files (svg/png/webp/jpg/gif/avif) become the icons, sorted by filename."),
    template: z
      .enum(["showcase", "scale-sweep", "color-sweep", "ripple", "pattern"])
      .optional()
      .describe("Load a named interaction preset (showcase/scale-sweep/color-sweep/ripple/pattern); your explicit options still override it."),
    output: z
      .object({
        format: z
          .enum(["video", "image"])
          .default("video")
          .describe('Emit a looping video ("video", mp4) or a single still ("image", png). Default "video".'),
        ...videoOutputShape({ width: 1080, height: 1080, deviceScaleFactor: 2 }),
        fileName: z.string().optional().describe('Output filename; defaults to "<slug(asset name)>.<mp4|png>".'),
        workers: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Parallel render workers (video). Omit to auto-pick from cores + free memory."),
      })
      .strict()
      .default({})
      .describe("Output frame + encoding settings."),
    motion: z
      .object({
        durationMs: z
          .number()
          .positive()
          .default(8000)
          .describe("Clip length in ms — the steps' at/span (and posterTime) are fractions of this. Default 8000."),
        posterTime: z
          .number()
          .min(0)
          .max(1)
          .default(0.5)
          .describe('For output.format "image": which clip moment to freeze, as a fraction of the timeline (0..1). Default 0.5.'),
      })
      .strict()
      .default({})
      .describe("Animation timeline: clip length + still sample point."),
    layout: z
      .object({
        columns: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Fixed column count. Omit to auto-pick a near-square grid from the icon count + frame aspect."),
        gap: z.number().nonnegative().default(32).describe("Gap between icons (px). Default 32."),
        padding: z.number().nonnegative().default(64).describe("Padding around the grid (px). Default 64."),
        iconSize: z.number().positive().optional().describe("Icon cell size (px). Omit to fit the grid to the frame."),
        background: z.string().default("#0b0b0f").describe('Backdrop behind the grid (any CSS color). Default "#0b0b0f".'),
        recolor: z
          .boolean()
          .default(true)
          .describe("Tint each icon via a CSS mask so it can be recoloured (shape from the file's alpha). Off = native colours. Default true."),
      })
      .strict()
      .default({})
      .describe("Grid layout + appearance (columns, gap, padding, iconSize, background, recolor)."),
    base: z
      .object({
        color: z.string().default("#f4f4f5").describe("Resting icon colour, tint mode (any CSS color). Default #f4f4f5."),
        scale: z.number().positive().default(1).describe("Resting icon scale multiplier. Default 1."),
        opacity: z.number().min(0).max(1).default(1).describe("Resting icon opacity (0..1). Default 1."),
        seed: z.number().int().default(1).describe("Seed for `random` sweep orders — same seed ⇒ identical animation. Default 1."),
      })
      .strict()
      .default({})
      .describe("Resting icon appearance + animation seed (color, scale, opacity, seed)."),
    accent: z.string().default(ACCENT).describe("Accent colour used by the recolour templates (any CSS color). Default #7c9cff."),
    steps: z
      .array(iconEffectSchema)
      .default([])
      .describe("The animation: an ordered list of effect steps (folded in order). Defaults to the template's steps."),
  })
  .strict();

/** Runtime validator: expands the selected `template`, then validates the merged options. */
export const iconsOptionsSchema = z.preprocess(applyTemplate, iconsObjectSchema);

/** Author-facing input (documented for editor hover; the schema above validates it at run time). */
export type IconsOptions = IconsOptionsInput;
/** Fully-resolved options after parsing. */
export type ResolvedIconsOptions = z.infer<typeof iconsObjectSchema>;

// Compile-time guard: the documented authoring type must stay in sync with the schema's input shape.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _iconsInputInSync: Exact<IconsOptionsInput, z.input<typeof iconsObjectSchema>> = true;
void _iconsInputInSync;
