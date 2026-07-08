import { z } from "zod";
import { videoOutputShape } from "@/generators/shared-options";

/** One step of a scripted interaction (see `actions` below). */
const interactionActionSchema = z
  .object({
    do: z
      .enum(["move", "click", "hover", "type", "scrollTo", "wait"])
      .describe("What this step does."),
    /** Target element for move/click/hover/type. */
    selector: z.string().optional().describe("Target element for move/click/hover/type."),
    /** Viewport-relative target for `move` without a selector (0..1). Also steers the real pointer. */
    x: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        "Viewport-relative X target for a selector-less `move` (0..1). Steers the real pointer too, so gliding into empty space lifts :hover off whatever was under it.",
      ),
    y: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Viewport-relative Y target for a selector-less `move` (0..1). Steers the real pointer too."),
    /** Text to type (for `type`). */
    text: z.string().optional().describe("Text to type (for `type`)."),
    /** Scroll target for `scrollTo`: a 0..1 number, an "NN%" string, or a CSS selector. */
    to: z
      .union([z.number(), z.string()])
      .optional()
      .describe('Scroll target for `scrollTo`: a 0..1 number, an "NN%" string, or a CSS selector.'),
    /** Cursor travel / scroll animation time (ms). Default 700. */
    durationMs: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Cursor travel / scroll animation time (ms). Default 700."),
    /** Pause after the step (ms). Default 600. */
    holdMs: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Pause after the step (ms). Default 600."),
  })
  .strict();

export const interactionOptionsSchema = z
  .object({
    /** Video output: size, scale, frame rate, encoding, filename. */
    output: z
      .object({ ...videoOutputShape({ width: 1280, height: 800, deviceScaleFactor: 2 }) })
      .strict()
      .default({}),
    /** Page load + interaction timing. */
    page: z
      .object({
        /** Dwell before the first step (ms). */
        startDelayMs: z
          .number()
          .int()
          .nonnegative()
          .default(500)
          .describe("Dwell before the first step (ms). Default 500."),
        /** Dwell after the last step (ms). */
        endDwellMs: z
          .number()
          .int()
          .nonnegative()
          .default(800)
          .describe("Dwell after the last step (ms). Default 800."),
        waitUntil: z
          .enum(["load", "domcontentloaded", "networkidle", "commit"])
          .default("networkidle")
          .describe('Page-load milestone to wait for before recording. Default "networkidle".'),
        /** Optional element to wait for before recording. */
        waitForSelector: z
          .string()
          .optional()
          .describe("Optional element to wait for before recording. Omit to skip."),
      })
      .strict()
      .default({}),
    /** Force a color scheme for the capture. */
    colorScheme: z
      .enum(["light", "dark"])
      .optional()
      .describe("Force a color scheme for the capture. Omit to leave as-is."),
    /**
     * The scripted steps (move / click / hover / type / scrollTo / wait), performed live with a
     * visible synthetic cursor. Omit only when `focus` alone (scroll-into-view + hold) is enough.
     */
    actions: z
      .array(interactionActionSchema)
      .default([])
      .describe(
        "The scripted steps (move/click/hover/type/scrollTo/wait), performed live with a visible cursor.",
      ),
    /**
     * Off-camera steps run before recording starts — pre-position the cursor, scroll, or set UI state
     * so frame 0 is exactly where you want it. Trimmed from the output. Key to a seamless loop: place
     * the cursor on the first target here (`durationMs: 0`) so the clip doesn't open with a glide-in.
     */
    setup: z
      .array(interactionActionSchema)
      .default([])
      .describe(
        "Off-camera steps run before recording starts (position cursor, scroll, set UI state). Trimmed from the output.",
      ),
    /**
     * Off-camera steps run after recording ends — reset the page to its opening state so a loop can
     * cut cleanly. Trimmed from the output.
     */
    teardown: z
      .array(interactionActionSchema)
      .default([])
      .describe(
        "Off-camera steps run after recording ends (reset state for a clean loop). Trimmed from the output.",
      ),
    /** The synthetic cursor shown during the recording. */
    cursor: z
      .object({
        show: z.boolean().optional().describe("Show the cursor. Default true."),
        size: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Cursor size (px). Default 22."),
        color: z.string().optional().describe("Cursor color. Default white-with-shadow."),
      })
      .strict()
      .optional()
      .describe("The synthetic cursor shown during the recording. Omit for the default cursor."),
    /**
     * Element-focused clip: scroll one component into view, optionally trigger it (`focus.actions`),
     * hold, and crop the output to its box (+padding).
     */
    focus: z
      .object({
        selector: z
          .string()
          .describe("Selector of the element to scroll into view and crop to."),
        /** Padding (px) around the element when cropping. Default 24. */
        padding: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Padding (px) around the element when cropping. Default 24."),
        /** Optional steps to trigger the component (e.g. open a dropdown) before holding. */
        actions: z
          .array(interactionActionSchema)
          .optional()
          .describe(
            "Optional steps to trigger the component (e.g. open a dropdown) before holding.",
          ),
        /** Time to dwell on the element after positioning/triggering (ms). Default 2000. */
        holdMs: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Time to dwell on the element after positioning / triggering (ms). Default 2000."),
      })
      .strict()
      .optional()
      .describe(
        "Element-focused clip: scroll one component into view, optionally trigger it, hold, and crop the output to its box. Omit for a full-viewport recording.",
      ),
  })
  .strict()
  .refine((o) => o.actions.length > 0 || o.focus, {
    message: "an interaction needs `actions` (a scripted tour) and/or `focus` (an element clip)",
    path: ["actions"],
  });

// ---------------------------------------------------------------------------
// Author-facing input types (editor autocomplete + hover docs), kept in sync
// with the schema by the Exact<> guard at the bottom.
// ---------------------------------------------------------------------------

/** One step of a scripted interaction (`actions` / `focus.actions`). */
export interface InteractionActionInput {
  /** What this step does. */
  do: "move" | "click" | "hover" | "type" | "scrollTo" | "wait";
  /** Target element for move/click/hover/type. */
  selector?: string;
  /** Viewport-relative X target for a selector-less `move` (0..1). Steers the real pointer too (lifts :hover). */
  x?: number;
  /** Viewport-relative Y target for a selector-less `move` (0..1). Steers the real pointer too. */
  y?: number;
  /** Text to type (for `type`). */
  text?: string;
  /** Scroll target for `scrollTo`: a 0..1 number, an "NN%" string, or a CSS selector. */
  to?: number | string;
  /** Cursor travel / scroll animation time (ms). Default 700. */
  durationMs?: number;
  /** Pause after the step (ms). Default 600. */
  holdMs?: number;
}

/** The synthetic cursor shown during the recording. */
export interface CursorInput {
  /** Show the cursor. Default true. */
  show?: boolean;
  /** Cursor size (px). Default 22. */
  size?: number;
  /** Cursor color. Default white-with-shadow. */
  color?: string;
}

/** Element-focused clip config (`focus`). */
export interface FocusInput {
  /** Selector of the element to scroll into view and crop to. */
  selector: string;
  /** Padding (px) around the element when cropping. Default 24. */
  padding?: number;
  /** Optional steps to trigger the component (e.g. open a dropdown) before holding. */
  actions?: InteractionActionInput[];
  /** Time to dwell on the element after positioning / triggering (ms). Default 2000. */
  holdMs?: number;
}

/** Video output: size, scale, frame rate, encoding, filename. */
export interface InteractionOutputInput {
  /** Output width in CSS px. Default 1280. */
  width?: number;
  /** Output height in CSS px. Default 800. */
  height?: number;
  /** Render scale (higher = crisper capture, downscaled into the video). Default 2. */
  deviceScaleFactor?: number;
  /** Output frames per second. Default 30. */
  fps?: number;
  /** x264 quality, 0–51 (lower = better quality / larger file). Default 18. */
  crf?: number;
  /** Output filename; defaults to "<slug(asset name)>.mp4". */
  fileName?: string;
}

/** Page load + interaction timing. */
export interface InteractionPageInput {
  /** Dwell before the first step (ms). Default 500. */
  startDelayMs?: number;
  /** Dwell after the last step (ms). Default 800. */
  endDwellMs?: number;
  /** Page-load milestone to wait for before recording. Default "networkidle". */
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  /** Optional element to wait for before recording. Omit to skip. */
  waitForSelector?: string;
}

/**
 * Author-facing options for the `interaction` generator — a realtime recording of a scripted
 * interaction ("tour") with a synthetic cursor, and/or an element-focused clip cropped to one
 * component. Give it `actions`, `focus`, or both. Site-cleanup toggles live in `settings.capture`.
 */
export interface InteractionOptionsInput {
  /** Video output: size, scale, frame rate, encoding, filename. */
  output?: InteractionOutputInput;
  /** Page load + interaction timing. */
  page?: InteractionPageInput;
  /** Force a color scheme for the capture. Omit to leave as-is. */
  colorScheme?: "light" | "dark";
  /**
   * The scripted steps (move/click/hover/type/scrollTo/wait), performed live with a visible
   * synthetic cursor. Omit only when `focus` alone (scroll-into-view + hold) is enough.
   */
  actions?: InteractionActionInput[];
  /**
   * Off-camera steps run before recording starts — pre-position the cursor, scroll, or set UI state
   * so frame 0 is exactly where you want it. Trimmed from the output. For a seamless loop, place the
   * cursor on the first target here (`durationMs: 0`) so the clip doesn't open with a glide-in.
   */
  setup?: InteractionActionInput[];
  /**
   * Off-camera steps run after recording ends — reset the page to its opening state so a loop cuts
   * cleanly. Trimmed from the output.
   */
  teardown?: InteractionActionInput[];
  /** The synthetic cursor shown during the recording. Omit for the default cursor. */
  cursor?: CursorInput;
  /**
   * Element-focused clip: scroll one component into view, optionally trigger it, hold, and crop the
   * output to its box. Omit for a full-viewport recording.
   */
  focus?: FocusInput;
}

/** Author-facing input (documented for editor hover; the schema validates it at run time). */
export type InteractionOptions = InteractionOptionsInput;
/** Fully-resolved options after parsing. */
export type ResolvedInteractionOptions = z.infer<typeof interactionOptionsSchema>;

// Compile-time guard: the documented authoring type must stay in sync with the schema's input shape.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _interactionInputInSync: Exact<
  InteractionOptionsInput,
  z.input<typeof interactionOptionsSchema>
> = true;
void _interactionInputInSync;
