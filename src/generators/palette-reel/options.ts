import { z } from "zod";
import { normalizeHex, type FieldId } from "@/generators/palette/color";
import type { PaletteColorInput } from "@/generators/palette/options";

/** Field ids that can be revealed on a band when it expands (same set as the still palette). */
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
  /** Sliver arrangement: horizontal bands (names upright) or full-height vertical strips. */
  orientation?: "rows" | "columns";
  /** Fields revealed when a color expands (the name is always shown, so it's ignored here). */
  details?: FieldId[];

  // --- timing (seconds) ---
  /** How long each color stays fully open before handing off to the next. */
  holdSeconds?: number;
  /** Crossfade length from one open color to the next. */
  transitionSeconds?: number;
  /**
   * Ping-pong the sweep (down the list then back up) so every handoff is between neighbouring bands —
   * the open band only ever slides by one, avoiding the "pinch" of a last→first jump at the loop seam.
   * Off wraps directly (last→first): shorter, but crossfades non-adjacent bands at the seam.
   */
  bounce?: boolean;
  /** Easing applied to the crossfade ramp. */
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  /** Clip length override (s). Omit to derive (count × (hold + transition)) for a clean loop. */
  durationSeconds?: number;

  // --- layout / sizing ---
  /** How many times a sliver's share a fully-open band takes (a collapsed sliver is the baseline). */
  grownFlex?: number;
  /** Minimum cross-size of a sliver in px so its name stays legible. Omit/0 to derive from height. */
  minCrossPx?: number;
  /** Keep the name fully visible even in a collapsed sliver (else it fades with the band). */
  nameAlwaysVisible?: boolean;

  // --- styling (carried from the still palette) ---
  /** Uppercase the color names. */
  uppercase?: boolean;
  /** RGB string style. */
  rgbStyle?: "labeled" | "css" | "plain";
  /** OKLCH string style. */
  oklchStyle?: "css" | "labeled";
  /** Text colors picked by contrast against each band. */
  textLight?: string;
  textDark?: string;
  /** Luminance above which the dark text is used (0..1). */
  contrastThreshold?: number;
  /** Custom font file (woff2/woff/ttf/otf), served into the render. Omit for a system bold sans. */
  fontFile?: string;
  /** Label font weight. */
  fontWeight?: number;
  /** Name font size in px. Omit to derive from the frame size. */
  fontSize?: number;
  /** Detail-line font size as a fraction of the name size. */
  detailFontScale?: number;
  /** Backdrop behind the bands (shown in `gap` between them). */
  background?: string;
  /** Gap between bands (px). */
  gap?: number;
  /** Band corner radius (px). */
  cornerRadius?: number;

  // --- output ---
  /** Output frame width in px. */
  width?: number;
  /** Output frame height in px. */
  height?: number;
  /** Render scale (higher = crisper capture, downscaled into the video). */
  deviceScaleFactor?: number;
  /** Output frames per second. */
  fps?: number;
  /** x264 quality, 0–51 (lower = better quality / larger file). */
  crf?: number;
  /** Output filename; defaults to "<slug(asset name)>.mp4". */
  fileName?: string;
}

const paletteReelObjectSchema = z
  .object({
    colors: z.array(z.object({ name: z.string().min(1), hex: hexString }).strict()).min(1),
    orientation: z.enum(["rows", "columns"]).default("rows"),
    details: z.array(fieldEnum).default(["hex", "oklch", "rgb"]),

    holdSeconds: z.number().positive().default(2),
    transitionSeconds: z.number().positive().default(0.7),
    bounce: z.boolean().default(true),
    easing: z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]).default("ease-in-out"),
    durationSeconds: z.number().positive().optional(),

    grownFlex: z.number().min(1).default(12),
    minCrossPx: z.number().nonnegative().default(0),
    nameAlwaysVisible: z.boolean().default(true),

    uppercase: z.boolean().default(false),
    rgbStyle: z.enum(["labeled", "css", "plain"]).default("labeled"),
    oklchStyle: z.enum(["css", "labeled"]).default("css"),
    textLight: z.string().default("#ffffff"),
    textDark: z.string().default("#141414"),
    contrastThreshold: z.number().min(0).max(1).default(0.5),
    fontFile: z.string().optional(),
    fontWeight: z.number().int().min(1).max(1000).default(700),
    fontSize: z.number().positive().optional(),
    detailFontScale: z.number().positive().default(0.62),
    background: z.string().default("#ffffff"),
    gap: z.number().nonnegative().default(0),
    cornerRadius: z.number().nonnegative().default(0),

    width: z.number().int().positive().default(1920),
    height: z.number().int().positive().default(1080),
    deviceScaleFactor: z.number().positive().max(4).default(1),
    fps: z.number().int().positive().max(120).default(30),
    crf: z.number().int().min(0).max(51).default(18),
    fileName: z.string().optional(),
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
