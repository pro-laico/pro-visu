import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import type { Browser, Page } from "playwright-core";

import { ensureDir } from "@/utils/fs";
import type { Logger } from "@/utils/logger";
import { applyCapture } from "@/pipeline/capture";
import { EASINGS, type Easing } from "@/generators/easing";
import type { ResolvedCaptureSettings } from "@/config/schema";
import type { ResolvedInteractionOptions } from "@/generators/interaction/options";
import { applyPostNav, installNetworkHygiene, installPreNav } from "@/pipeline/clean-capture";

/** Default cursor travel / scroll-animation time for a step that omits `durationMs`. */
export const DEFAULT_ACTION_DURATION_MS = 700;
/** Default `scrollTo` speed (CSS px/second) when a step gives neither `speed` nor `durationMs` — scrolls are distance-paced by default. */
export const DEFAULT_SCROLL_SPEED = 400;
/** Default pause for a `wait` step that omits `durationMs`. */
export const DEFAULT_WAIT_MS = 600;
/** Default per-keystroke pace for `type` (ms). */
export const DEFAULT_TYPE_DELAY_MS = 55;
/** Default per-keystroke pace for `erase` (ms). */
export const DEFAULT_ERASE_DELAY_MS = 80;
/** How far each keystroke gap is randomized (±fraction) so the cadence reads human, not metronomic. */
const KEYSTROKE_JITTER = 0.3;

/**
 * Pure: the nominal (pre-jitter) gap before each of `count` keystrokes, given a base per-key `delayMs`
 * and an `easing`. The gaps always sum to `delayMs * count` — easing only redistributes them (e.g.
 * "ease-out" front-loads the speed, so early gaps are short and later ones long) without changing the
 * total run time. Unit-tested.
 */
export function keystrokeGaps(count: number, delayMs: number, easing: Easing): number[] {
  if (count <= 0 || delayMs <= 0) return new Array(Math.max(0, count)).fill(0);
  const ease = EASINGS[easing];
  const total = delayMs * count;
  const gaps: number[] = [];
  let prev = 0;
  for (let i = 1; i <= count; i++) {
    const at = ease(i / count) * total;
    gaps.push(at - prev);
    prev = at;
  }
  return gaps;
}

/** Pure: total keystroke time a `type`/`erase` step adds (0 for other steps). `erase`-all counts 0 (length is only known at run time). */
export function writeDurationMs(a: { do: string; text?: string; count?: number; delayMs?: number }): number {
  if (a.do === "type") return (a.text?.length ?? 0) * (a.delayMs ?? DEFAULT_TYPE_DELAY_MS);
  if (a.do === "erase") return (a.count ?? 0) * (a.delayMs ?? DEFAULT_ERASE_DELAY_MS);
  return 0;
}
/** Default padding around a focused element when cropping. */
const DEFAULT_FOCUS_PADDING = 24;

/**
 * Pure: turn an element box (CSS px) + padding into an even-dimensioned crop rectangle clamped to the
 * viewport (h264 needs even width/height). Unit-tested.
 */
export function clampCrop(
  box: { x: number; y: number; w: number; h: number },
  padding: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number; width: number; height: number } {
  let x = Math.floor(box.x - padding);
  let y = Math.floor(box.y - padding);
  let w = Math.ceil(box.w + padding * 2);
  let h = Math.ceil(box.h + padding * 2);
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (y < 0) {
    h += y;
    y = 0;
  }
  if (x + w > viewportWidth) w = viewportWidth - x;
  if (y + h > viewportHeight) h = viewportHeight - y;
  w = Math.max(2, w - (w % 2));
  h = Math.max(2, h - (h % 2));
  x = Math.max(0, Math.min(x, viewportWidth - w));
  y = Math.max(0, Math.min(y, viewportHeight - h));
  return { x, y, width: w, height: h };
}

type InteractionAction = ResolvedInteractionOptions["actions"][number];

/**
 * Pure: estimated interaction clip length in ms (start delay + each step's travel/pause + keystroke
 * time + end dwell). An estimate only — the actual kept-window length is measured at run time (jitter,
 * `erase`-all length and speed-paced scrolls aren't known statically), so this is a lower bound used
 * for tests/sanity. A `wait` step contributes its `durationMs` (the pause); every other step its travel.
 */
export function interactionTotalMs(
  actions: Array<{ do?: string; text?: string; count?: number; delayMs?: number; durationMs?: number }>,
  startDelayMs: number,
  endDwellMs: number,
): number {
  let total = startDelayMs + endDwellMs;
  for (const a of actions) {
    const base = a.durationMs ?? (a.do === "wait" ? DEFAULT_WAIT_MS : DEFAULT_ACTION_DURATION_MS);
    total += base + writeDurationMs({ do: a.do ?? "", text: a.text, count: a.count, delayMs: a.delayMs });
  }
  return total;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Runs INSIDE the page. Installs a synthetic cursor and a `__sc` driver with eased moves, smooth
 * scrolling and a click pulse. Self-contained (serialized via page.evaluate / addInitScript); all
 * globals are read off `globalThis` so it carries no outer references.
 *
 * Nav-resilient: registered with `addInitScript` so it re-runs on every document (a full navigation
 * reinstalls it at DOMContentLoaded), and the cursor position lives on `globalThis.__scState` so it
 * survives client-side (SPA) navigations. Every driver call re-ensures the cursor node exists, so a
 * framework that wipes `<body>` on route change can't leave the cursor orphaned.
 */
function installCursorRuntime(opts: { show: boolean; size: number; color: string }): void {
  const g = globalThis as any; //EXCUSE: runs in the browser (page.evaluate/$eval/init script); DOM globals absent from Node lib types
  const doc = g.document;
  if (!doc) return;

  const boot = (): void => {
    if (!doc.body) return;
    if (g.__sc) {
      g.__sc.ensure();
      return;
    }
    const state = g.__scState || (g.__scState = { x: (g.innerWidth || 0) / 2, y: (g.innerHeight || 0) / 2 });

    const ensure = (): any => {
      if (!opts.show) return null;
      let cur = doc.getElementById("__sc_cursor");
      if (!cur) {
        cur = doc.createElement("div");
        cur.id = "__sc_cursor";
        cur.style.cssText = [
          "position:fixed",
          "width:" + opts.size + "px",
          "height:" + opts.size + "px",
          "margin-left:" + -opts.size / 2 + "px",
          "margin-top:" + -opts.size / 2 + "px",
          "border-radius:50%",
          "background:" + opts.color,
          "opacity:0.85",
          "pointer-events:none",
          "z-index:2147483647",
          "box-shadow:0 0 0 2px rgba(255,255,255,0.85)",
          "transition:transform 0.12s ease",
        ].join(";");
        doc.body.appendChild(cur);
      }
      cur.style.left = state.x + "px";
      cur.style.top = state.y + "px";
      return cur;
    };

    const setPos = (x: number, y: number): void => {
      state.x = x;
      state.y = y;
      const cur = ensure();
      if (cur) {
        cur.style.left = x + "px";
        cur.style.top = y + "px";
      }
    };
    const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    // The shared easing vocabulary (mirrors EASINGS in generators/easing.ts) so `scrollTo` can honor an author's `easing`.
    const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const easings: Record<string, (t: number) => number> = {
      linear: (t) => t,
      "ease-in": (t) => t * t * t,
      "ease-out": (t) => 1 - Math.pow(1 - t, 3),
      "ease-in-out": easeInOut,
      "ease-out-strong": (t) => 1 - Math.pow(1 - t, 5),
      "ease-in-out-strong": (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
    };
    const tween = (x1: number, y1: number, ms: number): Promise<void> =>
      new Promise((resolve) => {
        const x0 = state.x;
        const y0 = state.y;
        if (ms <= 0) {
          setPos(x1, y1);
          resolve();
          return;
        }
        let start: number | null = null;
        const step = (now: number): void => {
          if (start === null) start = now;
          const t = Math.min(1, (now - start) / ms);
          const e = ease(t);
          setPos(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e);
          if (t < 1) g.requestAnimationFrame(step);
          else resolve();
        };
        g.requestAnimationFrame(step);
      });

    g.__sc = {
      ensure,
      moveTo: (x: number, y: number, ms: number): Promise<void> => tween(x, y, ms),
      moveToFraction: (fx: number, fy: number, ms: number): Promise<void> =>
        tween((g.innerWidth || 0) * fx, (g.innerHeight || 0) * fy, ms),
      moveToSelector: async (sel: string, ms: number): Promise<void> => {
        const el = doc.querySelector(sel);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        await tween(rect.left + rect.width / 2, rect.top + rect.height / 2, ms);
      },
      scrollTo: async (to: any, ms: number, align?: string, offset?: number, headerH?: number, speed?: number, easing?: string): Promise<void> => {
        const se = doc.scrollingElement || doc.documentElement;
        const max = Math.max(0, se.scrollHeight - se.clientHeight);
        const off = offset || 0;
        let target = 0;
        if (typeof to === "number") target = to * max - off;
        else if (typeof to === "string" && to.trim().endsWith("%")) target = (parseFloat(to) / 100) * max - off;
        else if (typeof to === "string") {
          const el = doc.querySelector(to);
          if (el) {
            const rect = el.getBoundingClientRect();
            const elTopDoc = rect.top + (g.pageYOffset || 0);
            const vh = se.clientHeight || g.innerHeight || 0;
            if (align === "center") target = elTopDoc - (vh - rect.height) / 2 - (headerH || 0) / 2 - off;
            else if (align === "bottom") target = elTopDoc - (vh - rect.height) - off;
            else {
              let margin = 0;
              try {
                margin = parseFloat(g.getComputedStyle(el).scrollMarginTop) || 0;
              } catch {
                /* ignore */
              }
              // Coalesce (don't stack) the site's own scroll-margin-top with our stickyHeaderHeight — both
              // exist to clear the same header, so use whichever is larger or a `.section` (margin) target
              // lands twice as far down as a plain one.
              target = elTopDoc - Math.max(margin, headerH || 0) - off;
            }
          }
        }
        target = Math.max(0, Math.min(max, target));
        const from = g.pageYOffset || se.scrollTop || 0;
        // A `speed` (px/s) derives the duration from the actual distance, so a long scroll takes longer at a steady human pace; else use the fixed `ms`.
        const dur = speed && speed > 0 ? (Math.abs(target - from) / speed) * 1000 : ms;
        if (dur <= 0) {
          g.scrollTo(0, target);
          return;
        }
        const curve = (easing && easings[easing]) || easeInOut;
        await new Promise<void>((resolve) => {
          let start: number | null = null;
          const step = (now: number): void => {
            if (start === null) start = now;
            const t = Math.min(1, (now - start) / dur);
            g.scrollTo(0, from + (target - from) * curve(t));
            if (t < 1) g.requestAnimationFrame(step);
            else resolve();
          };
          g.requestAnimationFrame(step);
        });
      },
      pulse: (): void => {
        const cur = ensure();
        if (!cur) return;
        cur.style.transform = "scale(0.6)";
        g.setTimeout(() => {
          const c = doc.getElementById("__sc_cursor");
          if (c) c.style.transform = "scale(1)";
        }, 150);
      },
    };
    ensure();
  };

  if (doc.body) boot();
  else if (doc.addEventListener) doc.addEventListener("DOMContentLoaded", boot, { once: true });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Jitter a keystroke gap by ±KEYSTROKE_JITTER so the cadence reads human, clamped to ≥0. */
function jitter(ms: number): number {
  if (ms <= 0) return 0;
  return Math.max(0, ms * (1 + (Math.random() * 2 - 1) * KEYSTROKE_JITTER));
}

/**
 * Play a keystroke sequence on the focused field: `count` presses of `send()`, paced by the easing-
 * shaped gaps and humanized with jitter. Used by both `type` (send each character) and `erase` (send
 * Backspace). A gap of 0 (delayMs 0) plays the whole run in one tick — the "instant" mode.
 */
async function playKeystrokes(
  count: number,
  delayMs: number,
  easing: Easing,
  send: (i: number) => Promise<void>,
): Promise<void> {
  const gaps = keystrokeGaps(count, delayMs, easing);
  for (let i = 0; i < count; i++) {
    const gap = gaps[i] ?? 0;
    if (gap > 0) await sleep(jitter(gap));
    await send(i);
  }
}

/**
 * Is the element actually visible/clickable right now — its centre inside the viewport AND not covered
 * by anything (a sticky header, an overlay)? Used to warn about a missing `scrollTo`. Tests real
 * occlusion via `elementFromPoint` (which ignores the pointer-events:none synthetic cursor), so it
 * passes header controls that live in the header band yet correctly flags content tucked behind it.
 */
async function isOnScreen(page: Page, selector: string): Promise<boolean> {
  try {
    return await page.evaluate((sel: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any; //EXCUSE: runs in the browser (page.evaluate/$eval/init script); DOM globals absent from Node lib types
      const el = g.document?.querySelector(sel);
      if (!el) return true;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > g.innerWidth || cy > g.innerHeight) return false;
      const top = g.document.elementFromPoint(cx, cy);
      return !!top && (top === el || el.contains(top) || top.contains(el));
    }, selector);
  } catch {
    return true;
  }
}

/** Drive one interaction step: animate the cursor, then perform the real Playwright action. */
async function runAction(page: Page, a: InteractionAction, durationMs: number, logger: Logger, stickyHeaderHeight: number): Promise<void> {
  if (
    a.selector &&
    (a.do === "move" || a.do === "hover" || a.do === "click" || a.do === "type" || a.do === "erase")
  ) {
    try {
      await page.waitForSelector(a.selector, { state: "visible", timeout: 15000 });
    } catch {}
    if (!(await isOnScreen(page, a.selector))) {
      logger.warn(
        `${a.do} target "${a.selector}" is off-screen or covered — add a \`scrollTo\` before this step (the cursor never auto-scrolls).`,
      );
    }
  }
  switch (a.do) {
    case "wait":
      await sleep(a.durationMs ?? DEFAULT_WAIT_MS);
      return;
    case "scrollTo": {
      // scrollTo is distance-paced by default: with no `speed` and no explicit `durationMs`, use the default speed.
      // An explicit `durationMs` (including 0 for an instant jump) opts back into a fixed-time scroll.
      const scrollSpeed = a.speed ?? (a.durationMs == null ? DEFAULT_SCROLL_SPEED : 0);
      await page.evaluate(
        (p: { to: number | string; ms: number; align: string; offset: number; headerH: number; speed: number; easing: string }) =>
          (
            globalThis as {
              __sc?: {
                scrollTo(to: number | string, ms: number, align: string, offset: number, headerH: number, speed: number, easing: string): Promise<void>;
              };
            }
          ).__sc?.scrollTo(p.to, p.ms, p.align, p.offset, p.headerH, p.speed, p.easing),
        {
          to: a.to ?? a.selector ?? 0,
          ms: a.durationMs ?? 0,
          align: a.align ?? "top",
          offset: a.offset ?? 0,
          headerH: stickyHeaderHeight,
          speed: scrollSpeed,
          easing: a.easing ?? "",
        },
      ); //EXCUSE: runs in the browser (page.evaluate/$eval/init script); DOM globals absent from Node lib types
      return;
    }
    case "move":
      if (a.selector) {
        await page.evaluate(
          (p: { sel: string; ms: number }) =>
            (globalThis as { __sc?: { moveToSelector(s: string, ms: number): Promise<void> } }).__sc?.moveToSelector(
              p.sel,
              p.ms,
            ),
          { sel: a.selector, ms: durationMs },
        ); //EXCUSE: runs in the browser (page.evaluate/$eval/init script); DOM globals absent from Node lib types
      } else {
        const fx = a.x ?? 0.5;
        const fy = a.y ?? 0.5;
        await page.evaluate(
          (p: { x: number; y: number; ms: number }) =>
            (globalThis as { __sc?: { moveToFraction(x: number, y: number, ms: number): Promise<void> } }).__sc?.moveToFraction(
              p.x,
              p.y,
              p.ms,
            ),
          { x: fx, y: fy, ms: durationMs },
        ); //EXCUSE: runs in the browser (page.evaluate/$eval/init script); DOM globals absent from Node lib types
        const vp = page.viewportSize();
        if (vp) await page.mouse.move(fx * vp.width, fy * vp.height);
      }
      return;
    case "hover":
      if (!a.selector) return;
      await moveCursorToSelector(page, a.selector, durationMs);
      await page.hover(a.selector);
      return;
    case "click":
      if (!a.selector) return;
      await moveCursorToSelector(page, a.selector, durationMs);
      await page.evaluate(() => (globalThis as { __sc?: { pulse(): void } }).__sc?.pulse()); //EXCUSE: runs in the browser (page.evaluate/$eval/init script); DOM globals absent from Node lib types
      await page.click(a.selector);
      return;
    case "type": {
      if (a.selector) {
        await moveCursorToSelector(page, a.selector, durationMs);
        await page.click(a.selector);
      }
      const text = a.text ?? "";
      await playKeystrokes(
        text.length,
        a.delayMs ?? DEFAULT_TYPE_DELAY_MS,
        a.easing ?? "linear",
        (i) => page.keyboard.type(text.charAt(i)),
      );
      return;
    }
    case "erase": {
      if (a.selector) {
        await moveCursorToSelector(page, a.selector, durationMs);
        await page.click(a.selector);
      }
      await page.keyboard.press("End");
      const count =
        a.count ??
        (a.selector
          ? await page.$eval(a.selector, (el) => (el as unknown as { value?: string }).value?.length ?? 0) //EXCUSE: runs in the browser (page.evaluate/$eval/init script); DOM globals absent from Node lib types
          : 0);
      await playKeystrokes(
        count,
        a.delayMs ?? DEFAULT_ERASE_DELAY_MS,
        a.easing ?? "linear",
        () => page.keyboard.press("Backspace"),
      );
      return;
    }
    case "press": {
      if (!a.key) return;
      const combo = [...(a.modifiers ?? []), a.key].join("+");
      await page.keyboard.press(combo);
      return;
    }
  }
}

/** Run a list of steps in sequence (cursor travel + real action), warning on failure. To pause between steps, insert a `wait`. */
async function runActionList(
  page: Page,
  actions: InteractionAction[],
  label: string,
  logger: Logger,
  stickyHeaderHeight: number,
): Promise<void> {
  for (const a of actions) {
    const durationMs = a.durationMs ?? DEFAULT_ACTION_DURATION_MS;
    try {
      await runAction(page, a, durationMs, logger, stickyHeaderHeight);
    } catch (e) {
      logger.warn(`${label} step "${a.do}"${a.selector ? ` (${a.selector})` : ""} failed: ${(e as Error).message}`);
    }
  }
}

function moveCursorToSelector(page: Page, selector: string, ms: number): Promise<unknown> {
  return page.evaluate(
    (p: { sel: string; ms: number }) =>
      (globalThis as { __sc?: { moveToSelector(s: string, ms: number): Promise<void> } }).__sc?.moveToSelector(
        p.sel,
        p.ms,
      ),
    { sel: selector, ms },
  ); //EXCUSE: runs in the browser (page.evaluate/$eval/init script); DOM globals absent from Node lib types
}

export interface InteractionArgs {
  browser: Browser;
  url: string;
  options: ResolvedInteractionOptions;
  capture: ResolvedCaptureSettings;
  tmpDir: string;
  logger: Logger;
}

export interface InteractionResult {
  webmPath: string;
  /** Seconds of nav + warm-up before the first action — trim this off the head. */
  leadSeconds: number;
  /** Intended clip length (after the head trim). */
  durationSeconds: number;
}

/**
 * Record a scripted interaction in realtime: navigate, clean up, install the synthetic cursor, then run
 * the action sequence live while Playwright records. Returns the recording for downstream transcoding.
 */
export async function captureInteractionWebm(args: InteractionArgs): Promise<InteractionResult> {
  const { browser, url, options, tmpDir, logger } = args;
  await ensureDir(tmpDir);
  const recordDir = await mkdtemp(path.join(tmpDir, "rec-"));
  const context = await browser.newContext({
    viewport: { width: options.output.width, height: options.output.height },
    deviceScaleFactor: options.output.deviceScaleFactor,
    recordVideo: {
      dir: recordDir,
      size: { width: options.output.width, height: options.output.height },
    },
  });
  await applyCapture(context, args.capture, url);
  const page = await context.newPage();
  const video = page.video();
  const actions = options.actions;

  const recStart = Date.now();
  let leadSeconds = 0;
  let keptMs = 0;
  try {
    if (options.colorScheme) await page.emulateMedia({ colorScheme: options.colorScheme });
    await installNetworkHygiene(page, args.capture);
    await installPreNav(page, args.capture);
    logger.debug(`navigating to ${url} (waitUntil=${options.page.waitUntil})`);
    await page.goto(url, { waitUntil: options.page.waitUntil });
    if (options.page.waitForSelector) {
      await page.waitForSelector(options.page.waitForSelector, { state: "visible" });
    }
    await applyPostNav(page, args.capture, logger, { pauseMedia: false });
    try {
      await page.evaluate(() => (globalThis as { document?: { fonts?: { ready?: Promise<unknown> } } }).document?.fonts?.ready); //EXCUSE: runs in the browser (page.evaluate/$eval/init script); DOM globals absent from Node lib types
    } catch {}
    const cursorOpts = {
      show: options.cursor?.show ?? true,
      size: options.cursor?.size ?? 22,
      color: options.cursor?.color ?? "#0b0b0f",
    };
    await page.addInitScript(installCursorRuntime, cursorOpts);
    await page.evaluate(installCursorRuntime, cursorOpts);

    await runActionList(page, options.setup, "setup", logger, options.page.stickyHeaderHeight);

    const keptStart = Date.now();
    leadSeconds = (keptStart - recStart) / 1000;
    await sleep(options.page.startDelayMs);
    await runActionList(page, actions, "interaction", logger, options.page.stickyHeaderHeight);
    await sleep(options.page.endDwellMs);
    keptMs = Date.now() - keptStart;

    await runActionList(page, options.teardown, "teardown", logger, options.page.stickyHeaderHeight);
  } finally {
    await context.close();
  }

  if (!video) throw new Error("Playwright did not record a video (recordVideo inactive).");
  return { webmPath: await video.path(), leadSeconds, durationSeconds: keptMs / 1000 };
}

export interface FocusResult extends InteractionResult {
  /** The crop box (CSS px) to apply when transcoding. */
  cropBox: { x: number; y: number; width: number; height: number };
}

/**
 * Record an element-focused clip in realtime: scroll the component into view, optionally trigger it,
 * hold, and report the crop box (the element's final box + padding, clamped to the viewport). The caller
 * transcodes the recording cropped to that box.
 */
export async function captureFocusWebm(args: InteractionArgs): Promise<FocusResult> {
  const { browser, url, options, tmpDir, logger } = args;
  const focus = options.focus;
  if (!focus) throw new Error("captureFocusWebm called without options.focus");
  await ensureDir(tmpDir);
  const recordDir = await mkdtemp(path.join(tmpDir, "rec-"));
  const context = await browser.newContext({
    viewport: { width: options.output.width, height: options.output.height },
    deviceScaleFactor: options.output.deviceScaleFactor,
    recordVideo: {
      dir: recordDir,
      size: { width: options.output.width, height: options.output.height },
    },
  });
  await applyCapture(context, args.capture, url);
  const page = await context.newPage();
  const video = page.video();
  const actions = focus.actions ?? [];
  const padding = focus.padding ?? DEFAULT_FOCUS_PADDING;
  const twoFrames = (): Promise<void> =>
    page.evaluate(
      () =>
        new Promise<void>((res) => {
          const g = globalThis as unknown as { requestAnimationFrame(cb: () => void): void }; //EXCUSE: runs in the browser (page.evaluate/$eval/init script); DOM globals absent from Node lib types
          g.requestAnimationFrame(() => g.requestAnimationFrame(() => res()));
        }),
    );

  const recStart = Date.now();
  let leadSeconds = 0;
  let keptMs = 0;
  let cropBox = { x: 0, y: 0, width: options.output.width, height: options.output.height };
  try {
    if (options.colorScheme) await page.emulateMedia({ colorScheme: options.colorScheme });
    await installNetworkHygiene(page, args.capture);
    await installPreNav(page, args.capture);
    await page.goto(url, { waitUntil: options.page.waitUntil });
    if (options.page.waitForSelector) {
      await page.waitForSelector(options.page.waitForSelector, { state: "visible" });
    }
    await applyPostNav(page, args.capture, logger, { pauseMedia: false });
    const cursorOpts = {
      show: options.cursor?.show ?? true,
      size: options.cursor?.size ?? 22,
      color: options.cursor?.color ?? "#0b0b0f",
    };
    await page.addInitScript(installCursorRuntime, cursorOpts);
    await page.evaluate(installCursorRuntime, cursorOpts);
    await page.evaluate((sel: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (globalThis as any).document?.querySelector(sel); //EXCUSE: runs in the browser (page.evaluate/$eval/init script); DOM globals absent from Node lib types
      if (el) {
        try {
          el.scrollIntoView({ behavior: "instant", block: "center" });
        } catch {}
      }
    }, focus.selector);
    await twoFrames();

    await runActionList(page, options.setup, "setup", logger, options.page.stickyHeaderHeight);

    const keptStart = Date.now();
    leadSeconds = (keptStart - recStart) / 1000;
    await sleep(options.page.startDelayMs);
    await runActionList(page, actions, "focus", logger, options.page.stickyHeaderHeight);
    const box = await page.evaluate((sel: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (globalThis as any).document?.querySelector(sel); //EXCUSE: runs in the browser (page.evaluate/$eval/init script); DOM globals absent from Node lib types
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }, focus.selector);
    if (box && box.w > 0 && box.h > 0) {
      cropBox = clampCrop(box, padding, options.output.width, options.output.height);
    } else {
      logger.warn(`focus: selector "${focus.selector}" not found — capturing the full viewport`);
    }
    await sleep(options.page.endDwellMs);
    keptMs = Date.now() - keptStart;

    await runActionList(page, options.teardown, "teardown", logger, options.page.stickyHeaderHeight);
  } finally {
    await context.close();
  }

  if (!video) throw new Error("Playwright did not record a video (recordVideo inactive).");
  return { webmPath: await video.path(), leadSeconds, durationSeconds: keptMs / 1000, cropBox };
}
