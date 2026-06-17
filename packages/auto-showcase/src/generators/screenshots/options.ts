import { z } from "zod";

/** A named viewport to capture at. */
const breakpointSchema = z
  .object({
    name: z.string().min(1),
    width: z.number().int().positive(),
    /** Viewport height. Note: ignored for `fullPage` shots (Playwright resizes to the page height);
     *  only affects viewport/element captures. */
    height: z.number().int().positive().default(900),
    /** Override the generator-level deviceScaleFactor for this breakpoint. */
    deviceScaleFactor: z.number().positive().max(4).optional(),
  })
  .strict();
export type Breakpoint = z.infer<typeof breakpointSchema>;

/** A specific element to capture (in addition to the page) at each breakpoint. */
const elementShotSchema = z
  .object({
    selector: z.string().min(1),
    /** Used in the filename + manifest id. */
    name: z.string().min(1),
  })
  .strict();

export const screenshotsOptionsSchema = z
  .object({
    breakpoints: z
      .array(breakpointSchema)
      .min(1)
      .default([
        { name: "desktop", width: 1440, height: 900 },
        { name: "mobile", width: 390, height: 844 },
      ]),
    /** Capture the entire scrollable page (vs. just the viewport). */
    fullPage: z.boolean().default(true),
    format: z.enum(["png", "jpeg"]).default("png"),
    /** jpeg only, 1–100. */
    quality: z.number().int().min(1).max(100).optional(),
    deviceScaleFactor: z.number().positive().max(4).default(2),
    waitUntil: z
      .enum(["load", "domcontentloaded", "networkidle", "commit"])
      .default("networkidle"),
    waitForSelector: z.string().optional(),
    /** Element captures taken at every breakpoint. */
    elements: z.array(elementShotSchema).default([]),
    /** png only: capture with a transparent background. */
    omitBackground: z.boolean().default(false),
    /** Extra settle time after load before capturing (ms). */
    settleMs: z.number().int().nonnegative().default(0),
  })
  .strict()
  .refine((o) => !(o.format === "png" && o.quality != null), {
    message: "`quality` only applies to jpeg; remove it or set format: \"jpeg\".",
    path: ["quality"],
  });

// ---------------------------------------------------------------------------
// Author-facing input types (editor autocomplete + hover docs). JSDoc on the
// zod schema above does NOT surface on hover through `z.input`, so the docs
// live on these hand-written interfaces, kept in sync with the schema by the
// Exact<> guard at the bottom — a drift is a compile error.
// ---------------------------------------------------------------------------

/** A named viewport to capture at; each breakpoint emits its own asset. */
export interface BreakpointInput {
  /** Label for this viewport — used in the filename + manifest id (e.g. "desktop"). */
  name: string;
  /** Viewport width in CSS px. */
  width: number;
  /**
   * Viewport height in CSS px. Default 900. Ignored for `fullPage` shots (Playwright resizes to the
   * full page height); only affects viewport/element captures.
   */
  height?: number;
  /** Override the generator-level `deviceScaleFactor` for this breakpoint. Omit to inherit it. */
  deviceScaleFactor?: number;
}

/** A specific element to capture (in addition to the page) at each breakpoint. */
export interface ElementShotInput {
  /** CSS selector of the element to shoot. */
  selector: string;
  /** Name used in the filename + manifest id for this element shot. */
  name: string;
}

/**
 * Author-facing options for the `screenshots` generator — responsive stills of a page (one per
 * breakpoint), plus optional per-element crops. Everything is optional; sensible defaults apply.
 */
export interface ScreenshotsOptionsInput {
  /**
   * Viewports to capture at (at least one); each emits its own asset. Default:
   * desktop 1440×900 + mobile 390×844.
   */
  breakpoints?: BreakpointInput[];
  /** Capture the entire scrollable page (vs. just the viewport). Default true. */
  fullPage?: boolean;
  /** Image format. Default "png". */
  format?: "png" | "jpeg";
  /** JPEG quality, 1–100 (jpeg only; rejected for png). Omit for the encoder default. */
  quality?: number;
  /** Render scale (2 = retina-crisp). Default 2. */
  deviceScaleFactor?: number;
  /** Page-load milestone to wait for before capturing. Default "networkidle". */
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  /** Optional element to wait for before capturing (e.g. a hero image). Omit to skip. */
  waitForSelector?: string;
  /** Specific elements to crop (in addition to the page) at every breakpoint. Default none. */
  elements?: ElementShotInput[];
  /** Capture with a transparent background (png only). Default false. */
  omitBackground?: boolean;
  /** Extra settle time after load before capturing (ms). Default 0. */
  settleMs?: number;
}

/** Author-facing input (documented for editor hover; the schema validates it at run time). */
export type ScreenshotsOptions = ScreenshotsOptionsInput;
/** Fully-resolved options after parsing. */
export type ResolvedScreenshotsOptions = z.infer<typeof screenshotsOptionsSchema>;

// Compile-time guard: the documented authoring type must stay in sync with the schema's input shape.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _screenshotsInputInSync: Exact<
  ScreenshotsOptionsInput,
  z.input<typeof screenshotsOptionsSchema>
> = true;
void _screenshotsInputInSync;
