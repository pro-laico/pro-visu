import { z } from "zod";
import { normalizeHex, type FieldId } from "@/generators/palette/color";

/** Field ids that can be placed in a swatch corner. */
const fieldEnum = z.enum(["name", "hex", "rgb", "oklch", "hsl", "cmyk"]);

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

/**
 * Author-facing options for the `palette` generator — a still color-palette image. Each color is a
 * swatch labeled with the fields you place in its corners (name / hex / rgb / oklch / hsl / cmyk),
 * with auto-contrasting text. Only `colors` is required.
 */
export interface PaletteOptionsInput {
  /** The colors to show (at least one). */
  colors: PaletteColorInput[];
  /** Swatch arrangement: full-width bands, full-height columns, or an N-wide grid. Default "rows". */
  layout?: "rows" | "columns" | "grid";
  /** Columns when `layout: "grid"`. Default 3. */
  gridColumns?: number;
  /** Output width in px. Default 1400. */
  width?: number;
  /** Output height in px. Default 1750 (portrait 4:5 with the default width). */
  height?: number;
  /** Render scale (2 = retina-crisp). Default 2. */
  deviceScaleFactor?: number;
  /** Page background, shown only in the gaps between swatches. Default "#ffffff". */
  background?: string;
  /** Gap between swatches (px). Default 0 (swatches abut). */
  gap?: number;
  /** Swatch corner radius (px). Default 0 (square). */
  cornerRadius?: number;
  /** Fields stacked in the top-left corner. Default name + hex. */
  topLeft?: FieldId[];
  /** Fields stacked in the top-right corner. Default rgb + oklch. */
  topRight?: FieldId[];
  /** Fields stacked in the bottom-left corner. Default none. */
  bottomLeft?: FieldId[];
  /** Fields stacked in the bottom-right corner. Default none. */
  bottomRight?: FieldId[];
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
  /** Light text color, used on dark swatches (picked by contrast). Default "#ffffff". */
  textLight?: string;
  /** Dark text color, used on light swatches (picked by contrast). Default "#141414". */
  textDark?: string;
  /** Luminance above which the dark text is used (0..1). Default 0.5. */
  contrastThreshold?: number;
  /** Inset of the labels from the swatch edges (px). Omit to derive from the width. */
  padding?: number;
  /** Output filename; defaults to "<slug(asset name)>.png". */
  fileName?: string;
}

const paletteObjectSchema = z
  .object({
    colors: z.array(z.object({ name: z.string().min(1), hex: hexString }).strict()).min(1),
    layout: z.enum(["rows", "columns", "grid"]).default("rows"),
    gridColumns: z.number().int().min(1).max(12).default(3),
    width: z.number().int().positive().default(1400),
    height: z.number().int().positive().default(1750),
    deviceScaleFactor: z.number().positive().max(4).default(2),
    background: z.string().default("#ffffff"),
    gap: z.number().nonnegative().default(0),
    cornerRadius: z.number().nonnegative().default(0),
    topLeft: z.array(fieldEnum).default(["name", "hex"]),
    topRight: z.array(fieldEnum).default(["rgb", "oklch"]),
    bottomLeft: z.array(fieldEnum).default([]),
    bottomRight: z.array(fieldEnum).default([]),
    uppercase: z.boolean().default(false),
    rgbStyle: z.enum(["labeled", "css", "plain"]).default("labeled"),
    oklchStyle: z.enum(["css", "labeled"]).default("css"),
    fontFile: z.string().optional(),
    fontSize: z.number().positive().optional(),
    fontWeight: z.number().int().min(1).max(1000).default(700),
    textLight: z.string().default("#ffffff"),
    textDark: z.string().default("#141414"),
    contrastThreshold: z.number().min(0).max(1).default(0.5),
    padding: z.number().nonnegative().optional(),
    fileName: z.string().optional(),
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
