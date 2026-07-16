import { EASINGS, type Easing } from "@/generators/easing";

/** The shared easing vocabulary, re-exported under the name this module's callers use. */
export type EasingName = Easing;
export { EASINGS };

export interface PrepareScrollArgs {
  /** How long to wait at the bottom for lazy/below-the-fold content to load (ms). */
  settleMs: number;
}

export interface SeekScrollArgs {
  /** Normalized scroll position to jump to (0 = top, 1 = bottom). */
  normalizedY: number;
}

export interface MeasureOffsetsArgs {
  /** CSS selectors to resolve to normalized scroll positions (0..1). */
  selectors: string[];
  /**
   * Pixels a sticky/fixed header intrudes from the top — each resolved target is pulled UP by this so
   * the selector lands below the header, not under it. Measured by {@link measureTopInset}; default 0.
   */
  headerInsetPx?: number;
}

export interface MeasureTopInsetArgs {
  /** Don't count a top element taller than this fraction of the viewport (skips full-screen overlays). */
  maxFraction?: number;
  /**
   * Explicit sticky-header selector: measure THIS element's bottom edge (while pinned) instead of
   * running the fixed/sticky heuristic. For pages where the heuristic picks the wrong element.
   */
  selector?: string;
}

export interface DetectSectionsArgs {
  /** Minimum element height as a fraction of the viewport to count as a section. */
  minHeightFraction: number;
  /** Explicit section selector; overrides the heuristic when set (non-null). */
  selector: string | null;
  /** Cap on the number of returned sections. */
  maxSections: number;
  /**
   * Scroll all the way to the page bottom (footer included). When false (the default), footer
   * elements are excluded from the heuristic and the forced final scroll-to-bottom stop is skipped,
   * so the reel ends at the last content section instead of the footer.
   */
  includeFooter: boolean;
  /**
   * Pixels a sticky/fixed header intrudes from the top of the viewport. Each section target is pulled
   * UP by this, so a scrolled-to section sits just below the header instead of being clipped by it.
   * Measured once by {@link measureTopInset}; defaults to 0 (no header).
   */
  headerInsetPx?: number;
}

// ---------------------------------------------------------------------------
// In-page types. These are erased at compile time, so the serialized page
// functions below may reference them freely — only runtime identifiers must
// stay self-contained.
// ---------------------------------------------------------------------------

/** Minimal structural view of a scrollable element, as the in-page helpers use it. */
interface ScrollEl {
  scrollHeight: number;
  clientHeight: number;
  clientWidth: number;
  scrollTop: number;
  scrollTo?: (o: { top: number; left: number; behavior: string }) => void;
  style?: { scrollBehavior: string };
  getBoundingClientRect: () => { top: number; bottom: number; width: number; height: number };
  closest?: (sel: string) => unknown;
}

/** The shared in-page helper set installed on `globalThis.__pvScroll` by {@link installScrollRuntime}. */
interface ScrollHelpers {
  findScrollTarget(): ScrollEl;
  isDocTarget(t: ScrollEl): boolean;
  scrollTargetTo(t: ScrollEl, y: number): void;
  maxScrollOf(t: ScrollEl): number;
  forceInstant(t: ScrollEl): void;
}

declare const window: {
  scrollTo: (o: { top: number; left: number; behavior: string }) => void;
  innerHeight: number;
  innerWidth: number;
  pageYOffset: number;
  pageXOffset: number;
};
declare const document: {
  scrollingElement: ScrollEl | null;
  documentElement: ScrollEl & { style: { scrollBehavior: string }; clientWidth: number; scrollTop: number };
  body: ScrollEl;
  querySelectorAll: (sel: string) => ArrayLike<ScrollEl>;
  querySelector: (sel: string) => ScrollEl | null;
  images?: ArrayLike<{ decode?: () => Promise<void>; getBoundingClientRect: () => { top: number; bottom: number; width: number; height: number } }>;
  fonts?: { ready: Promise<unknown> };
};
declare const getComputedStyle: (el: ScrollEl) => { overflowY: string; position: string };
declare const requestAnimationFrame: (cb: (t: number) => void) => number;
declare const setTimeout: (cb: () => void, ms: number) => unknown;

/**
 * Runs INSIDE the page (via `page.addInitScript`, so it re-runs on every document). Installs the ONE
 * canonical copy of the scroll helpers on `globalThis.__pvScroll`; the page functions below pull them
 * from there instead of each inlining its own copy (five hand-synced copies had already drifted).
 * Installing once also keeps the per-frame `seekFrame` evaluate payload small — it runs thousands of
 * times per capture, so its serialized source size is protocol overhead that matters.
 */
export function installScrollRuntime(): void {
  const g = globalThis as { __pvScroll?: ScrollHelpers };
  if (g.__pvScroll) return;

  const findScrollTarget = (): ScrollEl => {
    const se = document.scrollingElement || document.documentElement;
    if (se && se.scrollHeight - se.clientHeight > 1) return se;
    let best: ScrollEl | null = null;
    let bestArea = 0;
    const all = document.querySelectorAll("*");
    for (let i = 0; i < all.length; i++) {
      const el = all[i]!;
      let oy = "";
      try {
        oy = getComputedStyle(el).overflowY;
      } catch {
        oy = "";
      }
      const scrollable = oy === "auto" || oy === "scroll" || oy === "overlay";
      if (scrollable && el.scrollHeight - el.clientHeight > 1) {
        const area = el.clientWidth * el.clientHeight;
        if (area > bestArea) {
          bestArea = area;
          best = el;
        }
      }
    }
    return best || se;
  };

  const isDocTarget = (t: ScrollEl): boolean =>
    t === (document.scrollingElement || document.documentElement) || t === document.documentElement || t === document.body;

  const scrollTargetTo = (t: ScrollEl, y: number): void => {
    if (isDocTarget(t)) window.scrollTo({ top: y, left: 0, behavior: "instant" });
    else if (t.scrollTo) t.scrollTo({ top: y, left: 0, behavior: "instant" });
    else t.scrollTop = y;
  };

  const maxScrollOf = (t: ScrollEl): number => Math.max(0, t.scrollHeight - t.clientHeight);

  const forceInstant = (t: ScrollEl): void => {
    try {
      document.documentElement.style.scrollBehavior = "auto";
    } catch {}
    try {
      if (t && t.style) t.style.scrollBehavior = "auto";
    } catch {}
  };

  g.__pvScroll = { findScrollTarget, isDocTarget, scrollTargetTo, maxScrollOf, forceInstant };
}

/**
 * Runs INSIDE the page. Warms the page for capture: disables smooth scrolling, jumps to the bottom
 * (instantly) to trigger lazy-loaded / intersection-mounted content and below-the-fold image
 * requests, waits for those plus fonts and image decode, then returns to the top. Meant to run
 * *before* the recording's trim point so none of this churn is visible in the final clip.
 */
export async function prepareScroll(args: PrepareScrollArgs): Promise<void> {
  const h = (globalThis as { __pvScroll?: ScrollHelpers }).__pvScroll;
  if (!h) throw new Error("pro-visu scroll runtime not installed");
  const target = h.findScrollTarget();
  h.forceInstant(target);

  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(() => resolve(), ms));
  const withCap = <T>(p: Promise<T> | null, ms: number): Promise<T | void> => Promise.race([p ?? Promise.resolve(), sleep(ms)]);

  h.scrollTargetTo(target, h.maxScrollOf(target));
  await sleep(Math.max(0, args.settleMs));
  try {
    await withCap(document.fonts?.ready ?? null, 5000);
  } catch {}
  try {
    const imgs = Array.from(document.images ?? []);
    await withCap(Promise.all(imgs.map((im) => (im.decode ? im.decode().catch(() => {}) : null))), 4000);
  } catch {}
  h.scrollTargetTo(target, 0);
  await sleep(50);
}

/**
 * Runs INSIDE the page. Auto-detects the page's section boundaries as normalized scroll positions
 * (0..1), sorted ascending and deduped. With `includeFooter` the bottom (1) is always the final stop;
 * without it (the default) footer elements are excluded and the reel ends at the last content section.
 * Uses an explicit selector when given, else a heuristic (<section>, direct children of <main>,
 * [data-section]) filtered to elements at least `minHeightFraction` of the viewport tall. Returns []
 * for a non-scrollable page.
 */
export async function detectSectionOffsets(args: DetectSectionsArgs): Promise<number[]> {
  const h = (globalThis as { __pvScroll?: ScrollHelpers }).__pvScroll;
  if (!h) throw new Error("pro-visu scroll runtime not installed");
  const target = h.findScrollTarget();
  const distance = h.maxScrollOf(target);
  if (distance <= 0) return [];
  const docTarget = h.isDocTarget(target);
  const vh = window.innerHeight || document.documentElement.clientHeight || 1;
  const containerTop = docTarget ? 0 : target.getBoundingClientRect().top;
  const curScroll = docTarget ? window.pageYOffset || document.documentElement.scrollTop || 0 : target.scrollTop;

  let els: ScrollEl[] = [];
  try {
    els = Array.from(document.querySelectorAll(args.selector || "section, main > *, [data-section]"));
  } catch {
    els = [];
  }
  const minH = vh * args.minHeightFraction;
  const offsets: number[] = [];
  for (const el of els) {
    let rect: { top: number; height: number };
    try {
      rect = el.getBoundingClientRect();
    } catch {
      continue;
    }
    if (!args.selector && rect.height < minH) continue;
    if (!args.includeFooter && !args.selector) {
      try {
        if (el.closest && el.closest('footer, [role="contentinfo"]')) continue;
      } catch {}
    }
    const rawTop = docTarget ? rect.top + curScroll : rect.top - containerTop + curScroll;
    const top = rawTop - (args.headerInsetPx ?? 0);
    const y = Math.max(0, Math.min(distance, top));
    offsets.push(y / distance);
  }
  offsets.sort((a, b) => a - b);
  const deduped: number[] = [];
  for (const o of offsets) {
    if (deduped.length === 0 || o - deduped[deduped.length - 1]! > 0.01) deduped.push(o);
  }
  if (deduped.length === 0 || (args.includeFooter && deduped[deduped.length - 1]! < 0.99)) deduped.push(1);
  return deduped.slice(0, args.maxSections);
}

/**
 * Runs INSIDE the page. Resolves CSS selectors to normalized scroll positions (0..1) on the real scroll
 * target — used by choreography to "scroll to a section". Returns null for a selector that matches no
 * element. Measured once after warm-up (positions are stable), so all workers agree.
 */
export async function measureNormalizedOffsets(args: MeasureOffsetsArgs): Promise<Array<number | null>> {
  const h = (globalThis as { __pvScroll?: ScrollHelpers }).__pvScroll;
  if (!h) throw new Error("pro-visu scroll runtime not installed");
  const target = h.findScrollTarget();
  const distance = h.maxScrollOf(target);
  const docTarget = h.isDocTarget(target);
  const containerTop = docTarget ? 0 : target.getBoundingClientRect().top;
  const curScroll = docTarget ? window.pageYOffset || document.documentElement.scrollTop || 0 : target.scrollTop;
  return args.selectors.map((sel) => {
    let el: ScrollEl | null = null;
    try {
      el = document.querySelector(sel);
    } catch {
      el = null;
    }
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const rawTop = docTarget ? rect.top + curScroll : rect.top - containerTop + curScroll;
    const offsetTop = rawTop - (args.headerInsetPx ?? 0);
    const y = Math.max(0, Math.min(distance, offsetTop));
    return distance > 0 ? y / distance : 0;
  });
}

/**
 * Runs INSIDE the page. Measures how far a sticky/fixed header intrudes from the top of the viewport
 * (px) so scroll targets can be pulled up by it — otherwise a scrolled-to section lands UNDER the
 * header and looks clipped. Probe-scrolls down one viewport so a `position: sticky` header is actually
 * pinned, takes the lowest bottom edge among wide, top-anchored fixed/sticky elements, then restores
 * the scroll. Returns 0 when there's no such header.
 */
export async function measureTopInset(args: MeasureTopInsetArgs): Promise<number> {
  const h = (globalThis as { __pvScroll?: ScrollHelpers }).__pvScroll;
  if (!h) throw new Error("pro-visu scroll runtime not installed");
  const target = h.findScrollTarget();
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const maxFraction = args.maxFraction ?? 0.4;
  const distance = h.maxScrollOf(target);
  const cur = h.isDocTarget(target) ? window.pageYOffset || document.documentElement.scrollTop || 0 : target.scrollTop;
  h.scrollTargetTo(target, Math.min(cur + vh, distance));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  let inset = 0;
  if (args.selector) {
    try {
      const el = document.querySelector(args.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.height > 0) inset = Math.max(0, r.bottom);
      }
    } catch {}
  } else {
    try {
      const all = document.querySelectorAll("body *");
      for (let i = 0; i < all.length; i++) {
        const el = all[i]!;
        let position = "";
        try {
          position = getComputedStyle(el).position;
        } catch {
          continue;
        }
        if (position !== "fixed" && position !== "sticky") continue;
        let r: { top: number; bottom: number; width: number; height: number };
        try {
          r = el.getBoundingClientRect();
        } catch {
          continue;
        }
        if (r.top <= 2 && r.width >= vw * 0.6 && r.height > 0 && r.bottom > inset && r.bottom <= vh * maxFraction) inset = r.bottom;
      }
    } catch {}
  }
  h.scrollTargetTo(target, cur);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return inset;
}

export interface SeekFrameArgs extends SeekScrollArgs {
  /**
   * Settle the CURRENT viewport's content before returning — wait for fonts and in-view image
   * decode, each capped IN-PAGE at this many ms so the evaluate always resolves (a stuck decode
   * must not stack pending protocol calls). Omit to skip settling (draft mode).
   */
  settleMaxMs?: number;
}

/**
 * Runs INSIDE the page. The per-frame step for frame-stepped site capture, combined into ONE
 * evaluate: scroll-seek → optional in-view settle. These used to be separate `page.evaluate`
 * round-trips per frame; over thousands of frames × parallel workers the protocol overhead was a
 * real slice of capture time — which is also why the helpers live in the init-script runtime
 * instead of being inlined here (a smaller serialized source per call).
 */
export async function seekFrame(args: SeekFrameArgs): Promise<void> {
  const h = (globalThis as { __pvScroll?: ScrollHelpers }).__pvScroll;
  if (!h) throw new Error("pro-visu scroll runtime not installed");
  const target = h.findScrollTarget();
  h.forceInstant(target);
  const distance = h.maxScrollOf(target);
  const clamped = args.normalizedY < 0 ? 0 : args.normalizedY > 1 ? 1 : args.normalizedY;
  h.scrollTargetTo(target, clamped * distance);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  if (args.settleMaxMs != null) {
    const maxMs = args.settleMaxMs;
    const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(() => resolve(), ms));
    const withCap = <T>(p: Promise<T> | null): Promise<T | void> => Promise.race([p ?? Promise.resolve(), sleep(maxMs)]);
    try {
      await withCap(document.fonts?.ready ?? null);
    } catch {}
    try {
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      const imgs = Array.from(document.images ?? []);
      const inView = imgs.filter((im) => {
        try {
          const r = im.getBoundingClientRect();
          return r.bottom > 0 && r.top < vh && r.width > 0 && r.height > 0;
        } catch {
          return false;
        }
      });
      await withCap(Promise.all(inView.map((im) => (im.decode ? im.decode().catch(() => {}) : null))));
    } catch {}
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}
