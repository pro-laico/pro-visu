import { z } from "zod";
import { normalizeHex, type FieldId } from "@/generators/palette/color";
import { easingSchema, type Easing } from "@/generators/easing";
import { videoOutputShape } from "@/generators/shared-options";
import type { PaletteColorInput } from "@/generators/palette/options";

/** Field ids that can be revealed on a band when it expands (same set as the still palette). */
const fieldEnum = z.enum(["name", "hex", "rgb", "oklch", "hsl"]);

const hexString = z.string().refine(
  (s) => {
    try {
      normalizeHex(s);
      return true;
    } catch {
      return false;
    }
  },
  { message: "must be a hex color like #D7DBDE" },
);

/** Output frame / encode settings for the reel video. */
export interface PaletteReelOutputInput {
  /** Output frame width in px. Default 1920. */
  width?: number;
  /** Output frame height in px. Default 1080. */
  height?: number;
  /** Render scale (higher = crisper capture, downscaled into the video). Default 1. */
  deviceScaleFactor?: number;
  /** Output frames per second. Default 30. */
  fps?: number;
  /** x264 quality, 0–51 (lower = better quality / larger file). Default 18. */
  crf?: number;
  /** Output filename; defaults to "<slug(asset name)>.mp4". */
  fileName?: string;
}

/** Reveal timing for the reel (all durations in milliseconds). */
export interface PaletteReelTimingInput {
  /** How long each color stays fully open before handing off to the next (ms). Default 2000. */
  holdMs?: number;
  /** Crossfade length from one open color to the next (ms). Default 700. */
  transitionMs?: number;
  /**
   * Ping-pong the sweep (down the list then back up) so every handoff is between neighbouring bands —
   * the open band only ever slides by one, avoiding the "pinch" of a last→first jump at the loop seam.
   * Off wraps directly (last→first): shorter, but crossfades non-adjacent bands at the seam. Default true.
   */
  bounce?: boolean;
  /** Easing applied to the crossfade ramp. Default "ease-in-out". */
  easing?: Easing;
  /** Clip length override (ms). Omit to derive (count × (hold + transition)) for a clean loop. */
  durationMs?: number;
}

/** Sliver arrangement and sizing for the bands. */
export interface PaletteReelLayoutInput {
  /** Sliver arrangement: horizontal bands (names upright) or full-height vertical strips. Default "rows". */
  orientation?: "rows" | "columns";
  /** How many times a sliver's share a fully-open band takes (a collapsed sliver is the baseline). Default 12. */
  grownFlex?: number;
  /** Minimum cross-size of a sliver in px so its name stays legible. Default 0 (derive from height). */
  minCrossPx?: number;
  /** Keep the name fully visible even in a collapsed sliver (else it fades with the band). Default true. */
  nameAlwaysVisible?: boolean;
  /** Backdrop behind the bands (shown in `gap` between them). Default "#ffffff". */
  background?: string;
  /** Gap between bands (px). Default 0 (bands abut). */
  gap?: number;
  /** Band corner radius (px). Default 0 (square). */
  cornerRadius?: number;
}

/** Label typography and formatting (carried from the still palette). */
export interface PaletteReelTextInput {
  /** Uppercase the color names. Default false. */
  uppercase?: boolean;
  /** RGB string style. Default "labeled". */
  rgbStyle?: "labeled" | "css" | "plain";
  /** OKLCH string style. Default "css". */
  oklchStyle?: "css" | "labeled";
  /** Custom font file (woff2/woff/ttf/otf), served into the render. Omit for a system bold sans. */
  fontFile?: string;
  /** Label font weight. Default 700. */
  fontWeight?: number;
  /** Name font size in px. Omit to derive from the frame size. */
  fontSize?: number;
  /** Detail-line font size as a fraction of the name size. Default 0.62. */
  detailFontScale?: number;
}

/** Text-color selection by band contrast. */
export interface PaletteReelContrastInput {
  /** Light text color, used on dark bands (picked by contrast). Default "#ffffff". */
  textLight?: string;
  /** Dark text color, used on light bands (picked by contrast). Default "#141414". */
  textDark?: string;
  /** Luminance above which the dark text is used (0..1). Default 0.5. */
  contrastThreshold?: number;
}

/**
 * Author-facing options for the `palette-reel` generator — a looping reveal *video* of a color
 * palette (the moving counterpart of the still `palette` generator). The colors start as thin
 * slivers showing only their name; one at a time a sliver expands into a band that reveals its
 * configured `details` (hex / oklch / rgb …), holds, then collapses before the next opens — sweeping
 * every color and looping seamlessly. Only `colors` is required; everything else has a default.
 */
export interface PaletteReelOptionsInput {
  /** The colors to reveal (at least one). */
  colors: PaletteColorInput[];
  /** Fields revealed when a color expands (the name is always shown, so it's ignored here). Default hex + oklch + rgb. */
  details?: FieldId[];
  /** Output frame / encode settings. */
  output?: PaletteReelOutputInput;
  /** Reveal timing (milliseconds). */
  timing?: PaletteReelTimingInput;
  /** Sliver arrangement and sizing. */
  layout?: PaletteReelLayoutInput;
  /** Label typography and formatting. */
  text?: PaletteReelTextInput;
  /** Text-color selection by band contrast. */
  contrast?: PaletteReelContrastInput;
}

const paletteReelObjectSchema = z
  .object({
    colors: z
      .array(
        z
          .object({
            name: z.string().min(1).describe("Display name shown on the color's sliver/band."),
            hex: hexString.describe("Color value as a hex string like #D7DBDE."),
          })
          .strict(),
      )
      .min(1)
      .describe("The colors to reveal (at least one)."),
    details: z
      .array(fieldEnum)
      .default(["hex", "oklch", "rgb"])
      .describe(
        "Fields revealed when a color expands (the name is always shown, so it's ignored here). Default hex + oklch + rgb.",
      ),

    output: z
      .object({
        ...videoOutputShape({ width: 1920, height: 1080, deviceScaleFactor: 1 }),
      })
      .strict()
      .default({}),

    timing: z
      .object({
        holdMs: z
          .number()
          .positive()
          .default(2000)
          .describe("How long each color stays fully open before handing off to the next (ms). Default 2000."),
        transitionMs: z
          .number()
          .positive()
          .default(700)
          .describe("Crossfade length from one open color to the next (ms). Default 700."),
        bounce: z
          .boolean()
          .default(true)
          .describe(
            "Ping-pong the sweep so each handoff is between neighbouring bands; off wraps directly (last to first). Default true.",
          ),
        easing: easingSchema
          .default("ease-in-out")
          .describe('Easing applied to the crossfade ramp. Default "ease-in-out".'),
        durationMs: z
          .number()
          .positive()
          .optional()
          .describe("Clip length override (ms). Omit to derive (count x (hold + transition)) for a clean loop."),
      })
      .strict()
      .default({}),

    layout: z
      .object({
        orientation: z
          .enum(["rows", "columns"])
          .default("rows")
          .describe(
            'Sliver arrangement: horizontal bands (names upright) or full-height vertical strips. Default "rows".',
          ),
        grownFlex: z
          .number()
          .min(1)
          .default(12)
          .describe(
            "How many times a sliver's share a fully-open band takes (a collapsed sliver is the baseline). Default 12.",
          ),
        minCrossPx: z
          .number()
          .nonnegative()
          .default(0)
          .describe("Minimum cross-size of a sliver in px so its name stays legible. Default 0 (derive from height)."),
        nameAlwaysVisible: z
          .boolean()
          .default(true)
          .describe(
            "Keep the name fully visible even in a collapsed sliver (else it fades with the band). Default true.",
          ),
        background: z
          .string()
          .default("#ffffff")
          .describe('Backdrop behind the bands (shown in `gap` between them). Default "#ffffff".'),
        gap: z
          .number()
          .nonnegative()
          .default(0)
          .describe("Gap between bands (px). Default 0 (bands abut)."),
        cornerRadius: z
          .number()
          .nonnegative()
          .default(0)
          .describe("Band corner radius (px). Default 0 (square)."),
      })
      .strict()
      .default({}),

    text: z
      .object({
        uppercase: z.boolean().default(false).describe("Uppercase the color names. Default false."),
        rgbStyle: z
          .enum(["labeled", "css", "plain"])
          .default("labeled")
          .describe('RGB string style. Default "labeled".'),
        oklchStyle: z
          .enum(["css", "labeled"])
          .default("css")
          .describe('OKLCH string style. Default "css".'),
        fontFile: z
          .string()
          .optional()
          .describe("Custom font file (woff2/woff/ttf/otf), served into the render. Omit for a system bold sans."),
        fontWeight: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .default(700)
          .describe("Label font weight. Default 700."),
        fontSize: z
          .number()
          .positive()
          .optional()
          .describe("Name font size in px. Omit to derive from the frame size."),
        detailFontScale: z
          .number()
          .positive()
          .default(0.62)
          .describe("Detail-line font size as a fraction of the name size. Default 0.62."),
      })
      .strict()
      .default({}),

    contrast: z
      .object({
        textLight: z
          .string()
          .default("#ffffff")
          .describe('Light text color, used on dark bands (picked by contrast). Default "#ffffff".'),
        textDark: z
          .string()
          .default("#141414")
          .describe('Dark text color, used on light bands (picked by contrast). Default "#141414".'),
        contrastThreshold: z
          .number()
          .min(0)
          .max(1)
          .default(0.5)
          .describe("Luminance above which the dark text is used (0..1). Default 0.5."),
      })
      .strict()
      .default({}),
  })
  .strict();

export const paletteReelOptionsSchema = paletteReelObjectSchema;

/** Author-facing input (documented for editor hover; the schema validates it at run time). */
export type PaletteReelOptions = PaletteReelOptionsInput;
/** Fully-resolved options after parsing. */
export type ResolvedPaletteReelOptions = z.infer<typeof paletteReelObjectSchema>;

// Compile-time guard: the documented authoring type must stay in sync with the schema's input shape.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _paletteReelInputInSync: Exact<
  PaletteReelOptionsInput,
  z.input<typeof paletteReelObjectSchema>
> = true;
void _paletteReelInputInSync;
