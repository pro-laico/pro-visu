import { z } from "zod";

/** A named viewport to capture at. */
export const breakpointSchema = z
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
export const elementShotSchema = z
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

export type ScreenshotsOptions = z.input<typeof screenshotsOptionsSchema>;
export type ResolvedScreenshotsOptions = z.infer<typeof screenshotsOptionsSchema>;
