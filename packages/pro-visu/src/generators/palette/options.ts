import { z } from "zod";

import { normalizeHex, type FieldId } from "@/generators/palette/color";

/** Field ids that can be placed in a swatch corner. */
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

/** One color in the palette. */
export interface PaletteColorInput {
  /** Display name, e.g. "Wet Grey". */
  name: string;
  /** Hex value (#rgb or #rrggbb, with or without #). */
  hex: string;
}

/** Output image sizing and filename. */
export interface PaletteOutputInput {
  /** Output width in px. Default 1400. */
  width?: number;
  /** Output height in px. Default 1750 (portrait 4:5 with the default width). */
  height?: number;
  /** Render scale (2 = retina-crisp). Default 2. */
  deviceScaleFactor?: number;
  /** Output filename; defaults to "<slug(asset name)>.png". */
  fileName?: string;
}

/** Swatch arrangement and spacing. */
export interface PaletteLayoutInput {
  /** Swatch arrangement: full-width bands, full-height columns, or an N-wide grid. Default "rows". */
  layout?: "rows" | "columns" | "grid";
  /** Columns when `layout: "grid"`. Default 3. */
  gridColumns?: number;
  /** Page background, shown only in the gaps between swatches. Default "#ffffff". */
  background?: string;
  /** Gap between swatches (px). Default 0 (swatches abut). */
  gap?: number;
  /** Swatch corner radius (px). Default 0 (square). */
  cornerRadius?: number;
  /** Inset of the labels from the swatch edges (px). Omit to derive from the width. */
  padding?: number;
}

/** Which fields land in which swatch corner. */
export interface PaletteFieldsInput {
  /** Fields stacked in the top-left corner. Default name + hex. */
  topLeft?: FieldId[];
  /** Fields stacked in the top-right corner. Default rgb + oklch. */
  topRight?: FieldId[];
  /** Fields stacked in the bottom-left corner. Default none. */
  bottomLeft?: FieldId[];
  /** Fields stacked in the bottom-right corner. Default none. */
  bottomRight?: FieldId[];
}

/** Label text styling and formatting. */
export interface PaletteTextInput {
  /** Uppercase the color names. Default false. */
  uppercase?: boolean;
  /** RGB string style. Default "labeled". */
  rgbStyle?: "labeled" | "css" | "plain";
  /** OKLCH string style. Default "css". */
  oklchStyle?: "css" | "labeled";
  /** Custom font file (woff2/woff/ttf/otf), embedded into the render. Omit for a system bold sans. */
  fontFile?: string;
  /** Label font size in px. Omit to derive from the width. */
  fontSize?: number;
  /** Label font weight. Default 700. */
  fontWeight?: number;
}

/** Auto-contrasting text colors and the luminance threshold that picks between them. */
export interface PaletteContrastInput {
  /** Light text color, used on dark swatches (picked by contrast). Default "#ffffff". */
  textLight?: string;
  /** Dark text color, used on light swatches (picked by contrast). Default "#141414". */
  textDark?: string;
  /** Luminance above which the dark text is used (0..1). Default 0.5. */
  contrastThreshold?: number;
}

/**
 * Author-facing options for the `palette` generator — a still color-palette image. Each color is a
 * swatch labeled with the fields you place in its corners (name / hex / rgb / oklch / hsl),
 * with auto-contrasting text. Only `colors` is required.
 */
export interface PaletteOptionsInput {
  /** The colors to show (at least one). */
  colors: PaletteColorInput[];
  /** Output image sizing and filename. */
  output?: PaletteOutputInput;
  /** Swatch arrangement and spacing. */
  layout?: PaletteLayoutInput;
  /** Which fields land in which swatch corner. */
  fields?: PaletteFieldsInput;
  /** Label text styling and formatting. */
  text?: PaletteTextInput;
  /** Auto-contrasting text colors and threshold. */
  contrast?: PaletteContrastInput;
}

const paletteObjectSchema = z.object({
    colors: z.array(
        z.object({
          name: z.string().min(1).describe('Display name, e.g. "Wet Grey".'),
          hex: hexString.describe("Hex value (#rgb or #rrggbb, with or without #)."),
        }).strict(),
      ).min(1).describe("The colors to show (at least one)."),
    output: z.object({
        width: z.number().int().positive().default(1400).describe("Output width in px. Default 1400."),
        height: z.number().int().positive().default(1750)
          .describe("Output height in px. Default 1750 (portrait 4:5 with the default width)."),
        deviceScaleFactor: z.number().positive().max(4).default(2).describe("Render scale (2 = retina-crisp). Default 2."),
        fileName: z.string().optional().describe('Output filename; defaults to "<slug(asset name)>.png".'),
      })
      .strict()
      .prefault({}),
    layout: z.object({
        layout: z.enum(["rows", "columns", "grid"]).default("rows")
          .describe('Swatch arrangement: full-width bands, full-height columns, or an N-wide grid. Default "rows".'),
        gridColumns: z.number().int().min(1).max(12).default(3).describe('Columns when layout is "grid". Default 3.'),
        background: z.string().default("#ffffff").describe('Page background, shown only in the gaps between swatches. Default "#ffffff".'),
        gap: z.number().nonnegative().default(0).describe("Gap between swatches (px). Default 0 (swatches abut)."),
        cornerRadius: z.number().nonnegative().default(0).describe("Swatch corner radius (px). Default 0 (square)."),
        padding: z.number().nonnegative().optional()
          .describe("Inset of the labels from the swatch edges (px). Omit to derive from the width."),
      })
      .strict()
      .prefault({}),
    fields: z.object({
        topLeft: z.array(fieldEnum).default(["name", "hex"]).describe("Fields stacked in the top-left corner. Default name + hex."),
        topRight: z.array(fieldEnum).default(["rgb", "oklch"]).describe("Fields stacked in the top-right corner. Default rgb + oklch."),
        bottomLeft: z.array(fieldEnum).default([]).describe("Fields stacked in the bottom-left corner. Default none."),
        bottomRight: z.array(fieldEnum).default([]).describe("Fields stacked in the bottom-right corner. Default none."),
      })
      .strict()
      .prefault({}),
    text: z.object({
        uppercase: z.boolean().default(false).describe("Uppercase the color names. Default false."),
        rgbStyle: z.enum(["labeled", "css", "plain"]).default("labeled").describe('RGB string style. Default "labeled".'),
        oklchStyle: z.enum(["css", "labeled"]).default("css").describe('OKLCH string style. Default "css".'),
        fontFile: z.string().optional()
          .describe("Custom font file (woff2/woff/ttf/otf), embedded into the render. Omit for a system bold sans."),
        fontSize: z.number().positive().optional().describe("Label font size in px. Omit to derive from the width."),
        fontWeight: z.number().int().min(1).max(1000).default(700).describe("Label font weight. Default 700."),
      })
      .strict()
      .prefault({}),
    contrast: z.object({
        textLight: z.string().default("#ffffff").describe('Light text color, used on dark swatches (picked by contrast). Default "#ffffff".'),
        textDark: z.string().default("#141414").describe('Dark text color, used on light swatches (picked by contrast). Default "#141414".'),
        contrastThreshold: z.number().min(0).max(1).default(0.5).describe("Luminance above which the dark text is used (0..1). Default 0.5."),
      })
      .strict()
      .prefault({}),
  })
  .strict();

export const paletteOptionsSchema = paletteObjectSchema;

/** Author-facing input (documented for editor hover; the schema validates it at run time). */
export type PaletteOptions = PaletteOptionsInput;
/** Fully-resolved options after parsing. */
export type ResolvedPaletteOptions = z.infer<typeof paletteObjectSchema>;

// Compile-time guard: the documented authoring type must stay in sync with the schema's input shape.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _paletteInputInSync: Exact<PaletteOptionsInput, z.input<typeof paletteObjectSchema>> = true;
void _paletteInputInSync;
