import { z } from "zod";

/**
 * A type-specimen video: point it at a font file and give it a name — the tool renders a 16:9
 * animated glyph grid (characters flickering between bold, dim, and absent) and captures it.
 * Everything else has sensible defaults.
 */
export const specimenOptionsSchema = z
  .object({
    /** Font file to showcase (path relative to the working dir, or absolute). Required. */
    font: z.string().min(1),
    /** Display name shown bottom-left (e.g. "ABC Oracle"). */
    name: z.string().default(""),
    /** 16:9 by default. */
    width: z.number().int().positive().default(1920),
    height: z.number().int().positive().default(1080),
    fps: z.number().int().positive().max(120).default(30),
    /** Clip length (seconds). */
    durationSeconds: z.number().positive().default(60),
    deviceScaleFactor: z.number().positive().max(4).default(1),
    /** Backdrop behind the glyphs. */
    background: z.string().default("#eceef1"),
    /** Grid shape. */
    columns: z.number().int().positive().default(9),
    rows: z.number().int().positive().default(3),
    /** Glyph weight (variable-font axis, 1–1000). */
    weight: z.number().int().min(1).max(1000).default(820),
    /** Glyph colors for the three visible states. */
    bold: z.string().default("#16181d"),
    mid: z.string().default("#a7adb6"),
    dim: z.string().default("#d3d7de"),
    crf: z.number().int().min(0).max(51).default(18),
    fileName: z.string().optional(),
  })
  .strict();

export type SpecimenOptions = z.input<typeof specimenOptionsSchema>;
export type ResolvedSpecimenOptions = z.infer<typeof specimenOptionsSchema>;
