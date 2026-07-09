import { z } from "zod";

import { namedViewportSchema, type ViewportInput } from "@/generators/shared-options";

export type ScreenshotViewport = z.infer<typeof namedViewportSchema>;

/** A specific element to capture (in addition to the page) at each viewport. */
const elementShotSchema = z.object({
    selector: z.string().min(1).describe("CSS selector of the element to shoot."),
    /** Used in the filename + manifest id. */
    name: z.string().min(1).describe("Name used in the filename + manifest id for this element shot."),
  }).strict();

export const screenshotsOptionsSchema = z.object({
    viewports: z.array(namedViewportSchema).min(1)
      .default([{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }])
      .describe("Viewports to capture at (at least one); each emits its own asset. Default: desktop 1440×900 + mobile 390×844."),
    /** Capture the entire scrollable page (vs. just the viewport). */
    fullPage: z.boolean().default(true).describe("Capture the entire scrollable page (vs. just the viewport). Default true."),
    /** Image output: format, quality, scale, transparency. */
    output: z.object({
        format: z.enum(["png", "jpeg"]).default("png").describe("Image format. Default \"png\"."),
        /** jpeg only, 1–100. */
        quality: z.number().int().min(1).max(100).optional()
          .describe("JPEG quality, 1–100 (jpeg only; rejected for png). Omit for the encoder default."),
        deviceScaleFactor: z.number().positive().max(4).default(2).describe("Render scale (2 = retina-crisp). Default 2."),
        /** png only: capture with a transparent background. */
        omitBackground: z.boolean().default(false).describe("Capture with a transparent background (png only). Default false."),
      }).strict()
      .default({}),
    /** Page load & settle timing. */
    page: z.object({
        waitUntil: z.enum(["load", "domcontentloaded", "networkidle", "commit"]).default("networkidle")
          .describe("Page-load milestone to wait for before capturing. Default \"networkidle\"."),
        waitForSelector: z.string().optional().describe("Optional element to wait for before capturing (e.g. a hero image). Omit to skip."),
        /** Extra settle time after load before capturing (ms). */
        settleMs: z.number().int().nonnegative().default(0).describe("Extra settle time after load before capturing (ms). Default 0."),
      }).strict()
      .default({}),
    /** Element captures taken at every viewport. */
    elements: z.array(elementShotSchema).default([])
      .describe("Specific elements to crop (in addition to the page) at every viewport. Default none."),
  }).strict()
  .refine((o) => !(o.output.format === "png" && o.output.quality != null), {
    message: "`quality` only applies to jpeg; remove it or set format: \"jpeg\".",
    path: ["output", "quality"],
  });

// ---------------------------------------------------------------------------
// Author-facing input types (editor autocomplete + hover docs). JSDoc on the
// zod schema above does NOT surface on hover through `z.input`, so the docs
// live on these hand-written interfaces, kept in sync with the schema by the
// Exact<> guard at the bottom — a drift is a compile error.
// ---------------------------------------------------------------------------

export type { ViewportInput };

/** A specific element to capture (in addition to the page) at each viewport. */
export interface ElementShotInput {
  /** CSS selector of the element to shoot. */
  selector: string;
  /** Name used in the filename + manifest id for this element shot. */
  name: string;
}

/** Image output: format, quality, scale, transparency. */
export interface ScreenshotsOutputInput {
  /** Image format. Default "png". */
  format?: "png" | "jpeg";
  /** JPEG quality, 1–100 (jpeg only; rejected for png). Omit for the encoder default. */
  quality?: number;
  /** Render scale (2 = retina-crisp). Default 2. */
  deviceScaleFactor?: number;
  /** Capture with a transparent background (png only). Default false. */
  omitBackground?: boolean;
}

/** Page load & settle timing. */
export interface ScreenshotsPageInput {
  /** Page-load milestone to wait for before capturing. Default "networkidle". */
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  /** Optional element to wait for before capturing (e.g. a hero image). Omit to skip. */
  waitForSelector?: string;
  /** Extra settle time after load before capturing (ms). Default 0. */
  settleMs?: number;
}

/**
 * Author-facing options for the `screenshots` generator — responsive stills of a page (one per
 * viewport), plus optional per-element crops. Everything is optional; sensible defaults apply.
 * Note: a viewport's `height` is ignored for `fullPage` shots (Playwright resizes to the page
 * height); it only affects viewport/element captures.
 */
export interface ScreenshotsOptionsInput {
  /**
   * Viewports to capture at (at least one); each emits its own asset. Default:
   * desktop 1440×900 + mobile 390×844.
   */
  viewports?: ViewportInput[];
  /** Capture the entire scrollable page (vs. just the viewport). Default true. */
  fullPage?: boolean;
  /** Image output: format, quality, scale, transparency. */
  output?: ScreenshotsOutputInput;
  /** Page load & settle timing. */
  page?: ScreenshotsPageInput;
  /** Specific elements to crop (in addition to the page) at every viewport. Default none. */
  elements?: ElementShotInput[];
}

/** Author-facing input (documented for editor hover; the schema validates it at run time). */
export type ScreenshotsOptions = ScreenshotsOptionsInput;
/** Fully-resolved options after parsing. */
export type ResolvedScreenshotsOptions = z.infer<typeof screenshotsOptionsSchema>;

// Compile-time guard: the documented authoring type must stay in sync with the schema's input shape.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _screenshotsInputInSync: Exact<ScreenshotsOptionsInput, z.input<typeof screenshotsOptionsSchema>> = true;
void _screenshotsInputInSync;
