import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import type { Browser, Page } from "playwright-core";
import { ensureDir } from "@/utils/fs";
import {
  applyPostNav,
  installNetworkHygiene,
  installPreNav,
} from "@/generators/scroll-reel/clean-capture";
import type { ResolvedScrollReelOptions } from "@/generators/scroll-reel/options";
import type { Logger } from "@/utils/logger";

/** Default cursor travel / scroll-animation time for a step that omits `durationMs`. */
export const DEFAULT_ACTION_DURATION_MS = 700;
/** Default pause after a step that omits `holdMs`. */
export const DEFAULT_ACTION_HOLD_MS = 600;
/** Default dwell on the focused element. */
const DEFAULT_FOCUS_HOLD_MS = 2000;
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

type InteractionAction = NonNullable<ResolvedScrollReelOptions["actions"]>[number];

/** Pure: total interaction clip length in ms (start delay + each step's travel + hold + end dwell). */
export function interactionTotalMs(
  actions: Array<{ durationMs?: number; holdMs?: number }>,
  startDelayMs: number,
  endDwellMs: number,
): number {
  let total = startDelayMs + endDwellMs;
  for (const a of actions) {
    total += (a.durationMs ?? DEFAULT_ACTION_DURATION_MS) + (a.holdMs ?? DEFAULT_ACTION_HOLD_MS);
  }
  return total;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Runs INSIDE the page. Installs a synthetic cursor and a `__sc` driver with eased moves, smooth
 * scrolling and a click pulse. Self-contained (serialized via page.evaluate); all globals are read off
 * `globalThis` so it carries no outer references.
 */
function installCursorRuntime(opts: { show: boolean; size: number; color: string }): void {
  const g = globalThis as any;
  const doc = g.document;
  if (!doc || !doc.body) return;

  let cur: any = null;
  if (opts.show) {
    cur = doc.createElement("div");
    cur.id = "__sc_cursor";
    cur.style.cssText = [
      "position:fixed",
      "left:50%",
      "top:50%",
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

  let curX = (g.innerWidth || 0) / 2;
  let curY = (g.innerHeight || 0) / 2;
  const setPos = (x: number, y: number): void => {
    curX = x;
    curY = y;
    if (cur) {
      cur.style.left = x + "px";
      cur.style.top = y + "px";
    }
  };
  const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const tween = (x1: number, y1: number, ms: number): Promise<void> =>
    new Promise((resolve) => {
      const x0 = curX;
      const y0 = curY;
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
    moveTo: (x: number, y: number, ms: number): Promise<void> => tween(x, y, ms),
    moveToFraction: (fx: number, fy: number, ms: number): Promise<void> =>
      tween((g.innerWidth || 0) * fx, (g.innerHeight || 0) * fy, ms),
    moveToSelector: async (sel: string, ms: number): Promise<void> => {
      const el = doc.querySelector(sel);
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: "instant", block: "center" });
      } catch {
        try {
          el.scrollIntoView();
        } catch {
          /* ignore */
        }
      }
      await new Promise<void>((r) => g.requestAnimationFrame(() => g.requestAnimationFrame(() => r())));
      const rect = el.getBoundingClientRect();
      await tween(rect.left + rect.width / 2, rect.top + rect.height / 2, ms);
    },
    scrollTo: async (to: any, ms: number): Promise<void> => {
      const se = doc.scrollingElement || doc.documentElement;
      const max = Math.max(0, se.scrollHeight - se.clientHeight);
      let target = 0;
      if (typeof to === "number") target = to * max;
      else if (typeof to === "string" && to.trim().endsWith("%")) target = (parseFloat(to) / 100) * max;
      else if (typeof to === "string") {
        const el = doc.querySelector(to);
        if (el) target = Math.max(0, Math.min(max, el.getBoundingClientRect().top + (g.pageYOffset || 0)));
      }
      const from = g.pageYOffset || se.scrollTop || 0;
      if (ms <= 0) {
        g.scrollTo(0, target);
        return;
      }
      await new Promise<void>((resolve) => {
        let start: number | null = null;
        const step = (now: number): void => {
          if (start === null) start = now;
          const t = Math.min(1, (now - start) / ms);
          g.scrollTo(0, from + (target - from) * ease(t));
          if (t < 1) g.requestAnimationFrame(step);
          else resolve();
        };
        g.requestAnimationFrame(step);
      });
    },
    pulse: (): void => {
      if (!cur) return;
      cur.style.transform = "scale(0.6)";
      g.setTimeout(() => {
        if (cur) cur.style.transform = "scale(1)";
      }, 150);
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Drive one interaction step: animate the cursor, then perform the real Playwright action. */
async function runAction(page: Page, a: InteractionAction, durationMs: number): Promise<void> {
  switch (a.do) {
    case "wait":
      return; // the per-step hold provides the pause
    case "scrollTo":
      await page.evaluate(
        (p: { to: number | string; ms: number }) =>
          (globalThis as { __sc?: { scrollTo(to: number | string, ms: number): Promise<void> } }).__sc?.scrollTo(
            p.to,
            p.ms,
          ),
        { to: a.to ?? a.selector ?? 0, ms: durationMs },
      );
      return;
    case "move":
      if (a.selector) {
        await page.evaluate(
          (p: { sel: string; ms: number }) =>
            (globalThis as { __sc?: { moveToSelector(s: string, ms: number): Promise<void> } }).__sc?.moveToSelector(
              p.sel,
              p.ms,
            ),
          { sel: a.selector, ms: durationMs },
        );
      } else {
        await page.evaluate(
          (p: { x: number; y: number; ms: number }) =>
            (globalThis as { __sc?: { moveToFraction(x: number, y: number, ms: number): Promise<void> } }).__sc?.moveToFraction(
              p.x,
              p.y,
              p.ms,
            ),
          { x: a.x ?? 0.5, y: a.y ?? 0.5, ms: durationMs },
        );
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
      await page.evaluate(() => (globalThis as { __sc?: { pulse(): void } }).__sc?.pulse());
      await page.click(a.selector);
      return;
    case "type":
      if (!a.selector) return;
      await moveCursorToSelector(page, a.selector, durationMs);
      await page.click(a.selector);
      if (a.text) await page.type(a.selector, a.text, { delay: 60 });
      return;
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
  );
}

export interface InteractionArgs {
  browser: Browser;
  url: string;
  options: ResolvedScrollReelOptions;
  colorScheme?: "light" | "dark";
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
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: options.deviceScaleFactor,
    recordVideo: { dir: recordDir, size: { width: options.width, height: options.height } },
  });
  const page = await context.newPage();
  const video = page.video();
  const actions = options.actions ?? [];
  const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

  const recStart = Date.now();
  let leadSeconds = 0;
  try {
    if (args.colorScheme) await page.emulateMedia({ colorScheme: args.colorScheme });
    await installNetworkHygiene(page, options);
    await installPreNav(page, options);
    logger.debug(`navigating to ${url} (waitUntil=${options.waitUntil})`);
    await page.goto(url, { waitUntil: options.waitUntil });
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { state: "visible" });
    }
    await applyPostNav(page, options, logger);
    try {
      await page.evaluate(
        () =>
          (globalThis as { document?: { fonts?: { ready?: Promise<unknown> } } }).document?.fonts?.ready,
      );
    } catch {
      /* no font set */
    }
    await page.evaluate(installCursorRuntime, {
      show: options.cursor?.show ?? true,
      size: options.cursor?.size ?? 22,
      color: options.cursor?.color ?? "#0b0b0f",
    });

    // Everything above is blank/churn in the recording; the scripted interaction starts now.
    leadSeconds = (Date.now() - recStart) / 1000;
    await sleep(options.startDelayMs);
    for (const a of actions) {
      const durationMs = a.durationMs ?? DEFAULT_ACTION_DURATION_MS;
      try {
        await runAction(page, a, durationMs);
      } catch (e) {
        logger.warn(`interaction step "${a.do}"${a.selector ? ` (${a.selector})` : ""} failed: ${(e as Error).message}`);
      }
      await sleep(a.holdMs ?? DEFAULT_ACTION_HOLD_MS);
    }
    await sleep(options.endDwellMs);
  } finally {
    await context.close();
  }

  if (!video) {
    throw new Error("Playwright did not record a video (recordVideo inactive).");
  }
  return {
    webmPath: await video.path(),
    leadSeconds,
    durationSeconds: interactionTotalMs(actions, options.startDelayMs, options.endDwellMs) / 1000,
  };
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
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: options.deviceScaleFactor,
    recordVideo: { dir: recordDir, size: { width: options.width, height: options.height } },
  });
  const page = await context.newPage();
  const video = page.video();
  const actions = focus.actions ?? [];
  const holdMs = focus.holdMs ?? DEFAULT_FOCUS_HOLD_MS;
  const padding = focus.padding ?? DEFAULT_FOCUS_PADDING;
  const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  const twoFrames = (): Promise<void> =>
    page.evaluate(
      () =>
        new Promise<void>((res) => {
          const g = globalThis as unknown as { requestAnimationFrame(cb: () => void): void };
          g.requestAnimationFrame(() => g.requestAnimationFrame(() => res()));
        }),
    );

  const recStart = Date.now();
  let leadSeconds = 0;
  let cropBox = { x: 0, y: 0, width: options.width, height: options.height };
  try {
    if (args.colorScheme) await page.emulateMedia({ colorScheme: args.colorScheme });
    await installNetworkHygiene(page, options);
    await installPreNav(page, options);
    await page.goto(url, { waitUntil: options.waitUntil });
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { state: "visible" });
    }
    await applyPostNav(page, options, logger);
    await page.evaluate(installCursorRuntime, {
      show: options.cursor?.show ?? true,
      size: options.cursor?.size ?? 22,
      color: options.cursor?.color ?? "#0b0b0f",
    });
    // Bring the element to the center before the kept clip starts.
    await page.evaluate((sel: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (globalThis as any).document?.querySelector(sel);
      if (el) {
        try {
          el.scrollIntoView({ behavior: "instant", block: "center" });
        } catch {
          /* ignore */
        }
      }
    }, focus.selector);
    await twoFrames();

    leadSeconds = (Date.now() - recStart) / 1000;
    await sleep(options.startDelayMs);
    for (const a of actions) {
      const durationMs = a.durationMs ?? DEFAULT_ACTION_DURATION_MS;
      try {
        await runAction(page, a, durationMs);
      } catch (e) {
        logger.warn(`focus step "${a.do}" failed: ${(e as Error).message}`);
      }
      await sleep(a.holdMs ?? DEFAULT_ACTION_HOLD_MS);
    }
    // Measure the element's final box (covers any expansion from the trigger) for the crop.
    const box = await page.evaluate((sel: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = (globalThis as any).document?.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }, focus.selector);
    if (box && box.w > 0 && box.h > 0) {
      cropBox = clampCrop(box, padding, options.width, options.height);
    } else {
      logger.warn(`focus: selector "${focus.selector}" not found — capturing the full viewport`);
    }
    await sleep(holdMs);
    await sleep(options.endDwellMs);
  } finally {
    await context.close();
  }

  if (!video) {
    throw new Error("Playwright did not record a video (recordVideo inactive).");
  }
  const durationSeconds =
    (options.startDelayMs + interactionTotalMs(actions, 0, 0) + holdMs + options.endDwellMs) / 1000;
  return { webmPath: await video.path(), leadSeconds, durationSeconds, cropBox };
}
