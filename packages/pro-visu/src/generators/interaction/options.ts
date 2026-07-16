import { z } from "zod";

import { videoOutputShape } from "@/generators/shared-options";
import { easingSchema, type Easing } from "@/generators/easing";

/** One step of a scripted interaction (see `actions` below). */
const interactionActionSchema = z.object({
    do: z.enum(["move", "click", "hover", "type", "erase", "press", "scrollTo", "wait"]).describe("What this step does."),
    /** Target element for move/click/hover/type/erase. */
    selector: z.string().optional()
      .describe("Target element for move/click/hover/type/erase (erase/type may omit it to act on the focused field)."),
    /** Viewport-relative target for `move` without a selector (0..1). Also steers the real pointer. */
    x: z.number().min(0).max(1).optional()
      .describe(
        "Viewport-relative X target for a selector-less `move` (0..1). Steers the real pointer too, so gliding into empty space lifts :hover off whatever was under it.",
      ),
    y: z.number().min(0).max(1).optional()
      .describe("Viewport-relative Y target for a selector-less `move` (0..1). Steers the real pointer too."),
    /** Text to type (for `type`). */
    text: z.string().optional().describe("Text to type (for `type`)."),
    /** Chars to remove from the caret (for `erase`). Omit to erase the whole field. */
    count: z.number().int().nonnegative().optional()
      .describe("For `erase`: how many characters to remove from the caret. Omit to erase the whole field."),
    /** Per-keystroke pace for `type`/`erase` (ms). 0 = instant. */
    delayMs: z.number().int().nonnegative().optional()
      .describe(
        "For `type`/`erase`: milliseconds between keystrokes (0 = instant). Default 55 (type) / 80 (erase). Humanized with mild jitter.",
      ),
    /** Eases a `scrollTo` motion, or the per-keystroke cadence of a `type`/`erase` run. */
    easing: easingSchema.optional()
      .describe(
        'Eases the motion curve. For `scrollTo`: shapes the scroll travel — "linear" holds a constant velocity (natural with `speed`), "ease-in-out" (the default) softens both ends. For `type`/`erase`: eases the keystroke cadence across the run — "ease-in" starts quick and trails off, "ease-out" starts measured and quickens — without changing the total time (default "linear").',
      ),
    /** Key to press (for `press`), e.g. "Enter", "Escape", "ArrowDown", "f". */
    key: z.string().optional().describe('For `press`: the key to press, e.g. "Enter", "Escape", "ArrowDown", or "f".'),
    /** Modifier keys held during a `press` (chord), e.g. ["Control"] for Ctrl+F. */
    modifiers: z.array(z.enum(["Control", "Shift", "Alt", "Meta"])).optional()
      .describe('For `press`: modifier keys held during the press, e.g. ["Control"] for Ctrl+F.'),
    /** Scroll target for `scrollTo`: a 0..1 number, an "NN%" string, or a CSS selector. */
    to: z.union([z.number(), z.string()]).optional()
      .describe('Scroll target for `scrollTo`: a 0..1 number, an "NN%" string, or a CSS selector.'),
    /** For `scrollTo` to a selector: where the target lands in the viewport. */
    align: z.enum(["top", "center", "bottom"]).optional()
      .describe('For `scrollTo` to a selector: where the target lands in the viewport. Default "top".'),
    /** For `scrollTo`: px to nudge the resting position (top-align: +N leaves N px above the target; −N scrolls past it). */
    offset: z.number().int().optional()
      .describe(
        "For `scrollTo`: px to nudge the final scroll position. Top-aligned, a positive offset leaves that many px of room above the target; negative scrolls past it.",
      ),
    /** Cursor travel time (ms, default 700). For `scrollTo` a FIXED scroll time (0 = instant); for `wait` how long to pause (default 600). */
    durationMs: z.number().int().nonnegative().optional()
      .describe(
        "Cursor travel time (ms), default 700. For `scrollTo` it instead sets a FIXED scroll time, overriding the default speed-based pacing — `durationMs: 0` jumps instantly (handy in `setup`). For `wait` it's how long to pause (default 600). Steps have no built-in trailing pause — insert a `wait` between steps to hold.",
      ),
    /** For `scrollTo`: scroll speed in CSS px/second — the clip runs as long as the distance needs. Default 400. */
    speed: z.number().positive().optional()
      .describe(
        "For `scrollTo`: scroll speed in CSS px/second. Scrolls are speed-paced by default (400 px/s) — the step runs for as long as the distance needs (distance ÷ speed), so a long page scrolls for longer at a steady, human pace. Set an explicit `durationMs` to force a fixed-time scroll instead.",
      ),
  })
  .strict();

export const interactionOptionsSchema = z.object({
    /** Video output: size, scale, frame rate, encoding, filename. */
    output: z.object({ ...videoOutputShape({ width: 1280, height: 800, deviceScaleFactor: 2 }) }).strict().prefault({}),
    /** Page load + interaction timing. */
    page: z.object({
        /** Dwell before the first step (ms). */
        startDelayMs: z.number().int().nonnegative().default(500).describe("Dwell before the first step (ms). Default 500."),
        /** Dwell after the last step (ms). */
        endDwellMs: z.number().int().nonnegative().default(800).describe("Dwell after the last step (ms). Default 800."),
        waitUntil: z.enum(["load", "domcontentloaded", "networkidle", "commit"]).default("networkidle")
          .describe('Page-load milestone to wait for before recording. Default "networkidle".'),
        /** Optional element to wait for before recording. */
        waitForSelector: z.string().optional().describe("Optional element to wait for before recording. Omit to skip."),
        /** Height (px) of a sticky/fixed header. `scrollTo` keeps targets clear of it (see align). */
        stickyHeaderHeight: z.number().int().nonnegative().default(0)
          .describe(
            "Height (px) of a sticky/fixed header. `scrollTo` keeps targets clear of it: top-align drops them below it (coalesced with the target's own CSS `scroll-margin-top` — the larger wins, not summed — then the step's `offset` stacks on top), center-align uses half of it, bottom-align is unaffected. Default 0.",
          ),
      })
      .strict()
      .prefault({}),
    /** Force a color scheme for the capture. */
    colorScheme: z.enum(["light", "dark"]).optional().describe("Force a color scheme for the capture. Omit to leave as-is."),
    /**
     * The scripted steps (move / click / hover / type / erase / press / scrollTo / wait), performed
     * live with a visible synthetic cursor. Omit only when `focus` alone (scroll-into-view + hold) is
     * enough.
     */
    actions: z.array(interactionActionSchema).default([])
      .describe("The scripted steps (move/click/hover/type/erase/press/scrollTo/wait), performed live with a visible cursor."),
    /**
     * Off-camera steps run before recording starts — pre-position the cursor, scroll, or set UI state
     * so frame 0 is exactly where you want it. Trimmed from the output. Key to a seamless loop: place
     * the cursor on the first target here (`durationMs: 0`) so the clip doesn't open with a glide-in.
     */
    setup: z.array(interactionActionSchema).default([])
      .describe("Off-camera steps run before recording starts (position cursor, scroll, set UI state). Trimmed from the output."),
    /**
     * Off-camera steps run after recording ends — reset the page to its opening state so a loop can
     * cut cleanly. Trimmed from the output.
     */
    teardown: z.array(interactionActionSchema).default([])
      .describe("Off-camera steps run after recording ends (reset state for a clean loop). Trimmed from the output."),
    /** Fail the asset when any step fails, instead of warning and continuing. */
    strictSteps: z.boolean().default(false)
      .describe(
        "Fail the asset when any step fails (missing selector, click timeout), instead of logging a warning and shipping the clip without that step. Default false.",
      ),
    /** The synthetic cursor shown during the recording. */
    cursor: z.object({
        show: z.boolean().optional().describe("Show the cursor. Default true."),
        size: z.number().int().positive().optional().describe("Cursor size (px). Default 22."),
        color: z.string().optional().describe("Cursor color. Default white-with-shadow."),
      }).strict().optional().describe("The synthetic cursor shown during the recording. Omit for the default cursor."),
    /**
     * Element-focused clip: scroll one component into view, optionally trigger/dwell via `focus.actions`,
     * and crop the output to its box (+padding). To hold on the element, end `focus.actions` with a `wait`.
     */
    focus: z.object({
        selector: z.string().describe("Selector of the element to scroll into view and crop to."),
        /** Padding (px) around the element when cropping. Default 24. */
        padding: z.number().int().nonnegative().optional().describe("Padding (px) around the element when cropping. Default 24."),
        /** Steps to trigger the component and/or dwell on it — end with a `wait` to hold. */
        actions: z.array(interactionActionSchema).optional()
          .describe("Steps to trigger the component (e.g. open a dropdown) and/or dwell on it — end with a `wait` to hold on the element."),
      }).strict()
      .optional()
      .describe(
        "Element-focused clip: scroll one component into view, optionally trigger/dwell it, and crop the output to its box. End `focus.actions` with a `wait` to hold. Omit for a full-viewport recording.",
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
  do: "move" | "click" | "hover" | "type" | "erase" | "press" | "scrollTo" | "wait";
  /** Target element for move/click/hover/type/erase (erase/type may omit it to act on the focused field). */
  selector?: string;
  /** Viewport-relative X target for a selector-less `move` (0..1). Steers the real pointer too (lifts :hover). */
  x?: number;
  /** Viewport-relative Y target for a selector-less `move` (0..1). Steers the real pointer too. */
  y?: number;
  /** Text to type (for `type`). */
  text?: string;
  /** For `erase`: how many characters to remove from the caret. Omit to erase the whole field. */
  count?: number;
  /** For `type`/`erase`: ms between keystrokes (0 = instant). Default 55 (type) / 80 (erase). Jittered. */
  delayMs?: number;
  /** Eases a `scrollTo` motion ("linear" = constant velocity, "ease-in-out" default), or the `type`/`erase` keystroke cadence (default "linear"). */
  easing?: Easing;
  /** For `press`: the key to press, e.g. "Enter", "Escape", "ArrowDown", "f". */
  key?: string;
  /** For `press`: modifier keys held during the press, e.g. ["Control"] for Ctrl+F. */
  modifiers?: ("Control" | "Shift" | "Alt" | "Meta")[];
  /** Scroll target for `scrollTo`: a 0..1 number, an "NN%" string, or a CSS selector. */
  to?: number | string;
  /** For `scrollTo` to a selector: where the target lands in the viewport. Default "top". */
  align?: "top" | "center" | "bottom";
  /** For `scrollTo`: px to nudge the resting position (top-align: +N leaves N px above the target; −N scrolls past it). */
  offset?: number;
  /** Cursor travel time (ms, default 700). For `scrollTo`: a FIXED scroll time (0 = instant). For `wait`: how long to pause (default 600). */
  durationMs?: number;
  /** For `scrollTo`: scroll speed in CSS px/second. Scrolls are speed-paced by default (400) — runs as long as distance ÷ speed needs. Set `durationMs` for a fixed-time scroll. */
  speed?: number;
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
  /** Steps to trigger the component and/or dwell on it — end with a `wait` to hold on the element. */
  actions?: InteractionActionInput[];
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
  /** Height (px) of a sticky/fixed header; `scrollTo` keeps targets clear of it (top: fully below, center: half, bottom: none). Default 0. */
  stickyHeaderHeight?: number;
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
   * The scripted steps (move/click/hover/type/erase/press/scrollTo/wait), performed live with a
   * visible synthetic cursor. Omit only when `focus` alone (scroll-into-view + hold) is enough.
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
  /**
   * Fail the asset when any step fails (missing selector, click timeout), instead of logging a
   * warning and shipping the clip without that step. Default false.
   */
  strictSteps?: boolean;
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
const _interactionInputInSync: Exact<InteractionOptionsInput, z.input<typeof interactionOptionsSchema>> = true;
void _interactionInputInSync;
