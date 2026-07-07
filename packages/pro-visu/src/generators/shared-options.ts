import { z } from "zod";

/**
 * Option fragments shared by generators, so the common knobs (output size, encoding, frame-stepped
 * capture, viewports) are declared once with consistent wording and constraints. Each generator
 * spreads a fragment into its own schema with its own defaults — intentional per-generator defaults
 * (e.g. a 1920×1080 scene vs a 1280×800 page reel) stay visible at the call site.
 */

export interface VideoOutputDefaults {
  width: number;
  height: number;
  deviceScaleFactor: number;
  fps?: number;
  crf?: number;
}

/** width / height / deviceScaleFactor / fps / crf / fileName — the universal video-output block. */
export function videoOutputShape(d: VideoOutputDefaults): {
  width: z.ZodDefault<z.ZodNumber>;
  height: z.ZodDefault<z.ZodNumber>;
  deviceScaleFactor: z.ZodDefault<z.ZodNumber>;
  fps: z.ZodDefault<z.ZodNumber>;
  crf: z.ZodDefault<z.ZodNumber>;
  fileName: z.ZodOptional<z.ZodString>;
} {
  return {
    width: z
      .number()
      .int()
      .positive()
      .default(d.width)
      .describe(`Output width in CSS px. Default ${d.width}.`),
    height: z
      .number()
      .int()
      .positive()
      .default(d.height)
      .describe(`Output height in CSS px. Default ${d.height}.`),
    deviceScaleFactor: z
      .number()
      .positive()
      .max(4)
      .default(d.deviceScaleFactor)
      .describe(
        `Render scale (higher = crisper capture, downscaled into the video). Default ${d.deviceScaleFactor}.`,
      ),
    fps: z
      .number()
      .int()
      .positive()
      .max(120)
      .default(d.fps ?? 30)
      .describe(`Output frames per second. Default ${d.fps ?? 30}.`),
    crf: z
      .number()
      .int()
      .min(0)
      .max(51)
      .default(d.crf ?? 18)
      .describe(`x264 quality, 0–51 (lower = better quality / larger file). Default ${d.crf ?? 18}.`),
    fileName: z
      .string()
      .optional()
      .describe('Output filename; defaults to "<slug(asset name)>.mp4".'),
  };
}

/** capture strategy / workers / frameFormat — the frame-stepped capture block. */
export function frameCaptureShape(): {
  capture: z.ZodDefault<z.ZodEnum<["frames", "realtime"]>>;
  workers: z.ZodOptional<z.ZodNumber>;
  frameFormat: z.ZodDefault<z.ZodEnum<["jpeg", "png"]>>;
} {
  return {
    capture: z
      .enum(["frames", "realtime"])
      .default("frames")
      .describe(
        '"frames" (default) steps a virtual clock per frame — frame-accurate, crisp, reproducible; "realtime" records the live session (for time-based animation / autoplay video).',
      ),
    workers: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Parallel render workers for "frames" (each its own browser context). Omit to auto-pick from cores + free memory.',
      ),
    frameFormat: z
      .enum(["jpeg", "png"])
      .default("jpeg")
      .describe('Intermediate frame format for "frames". "jpeg" (default) is faster; "png" is lossless.'),
  };
}

/** A named viewport, shared by scroll-reel and screenshots. */
export const namedViewportSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .describe('Label for this viewport — used in the asset id / filename (e.g. "desktop").'),
    width: z.number().int().positive().describe("Viewport width in CSS px."),
    height: z.number().int().positive().describe("Viewport height in CSS px."),
    deviceScaleFactor: z
      .number()
      .positive()
      .max(4)
      .optional()
      .describe("Override the generator-level `deviceScaleFactor` for this viewport. Omit to inherit it."),
  })
  .strict();

/** A named viewport to capture at; each viewport emits its own asset. */
export interface ViewportInput {
  /** Label for this viewport — used in the asset id / filename (e.g. "desktop"). */
  name: string;
  /** Viewport width in CSS px. */
  width: number;
  /** Viewport height in CSS px. */
  height: number;
  /** Override the generator-level `deviceScaleFactor` for this viewport. Omit to inherit it. */
  deviceScaleFactor?: number;
}
