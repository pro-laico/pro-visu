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
}

export interface DetectSectionsArgs {
  /** Minimum element height as a fraction of the viewport to count as a section. */
  minHeightFraction: number;
  /** Explicit section selector; overrides the heuristic when set (non-null). */
  selector: string | null;
  /** Cap on the number of returned sections. */
  maxSections: number;
  /**
   * Pixels a sticky/fixed header intrudes from the top of the viewport. Each section target is pulled
   * UP by this, so a scrolled-to section sits just below the header instead of being clipped by it.
   * Measured once by {@link measureTopInset}; defaults to 0 (no header).
   */
  headerInsetPx?: number;
}

// Browser globals — declared loosely (no DOM lib in this Node project). The exported functions are
// serialized and run inside the page via page.evaluate, so each must be fully self-contained (no
// references to module-level bindings); the small scroll helpers are therefore inlined in both.
declare const window: {
  scrollTo: (o: { top: number; left: number; behavior: string }) => void;
  innerHeight: number;
  innerWidth: number;
  pageYOffset: number;
  pageXOffset: number;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const document: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const getComputedStyle: (el: any) => { overflowY: string };
declare const requestAnimationFrame: (cb: (t: number) => void) => number;
declare const setTimeout: (cb: () => void, ms: number) => unknown;

/**
 * Runs INSIDE the page. Warms the page for capture: disables smooth scrolling, jumps to the bottom
 * (instantly) to trigger lazy-loaded / intersection-mounted content and below-the-fold image
 * requests, waits for those plus fonts and image decode, then returns to the top. Meant to run
 * *before* the recording's trim point so none of this churn is visible in the final clip.
 */
export async function prepareScroll(args: PrepareScrollArgs): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const target = findScrollTarget(document, getComputedStyle) as any;
  forceInstant(target);

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(() => resolve(), ms));
  // Cap any awaited promise so a never-settling one can't wedge the whole prepare step. A
  // `loading="lazy"` <img> that never enters the viewport (e.g. in a hidden carousel slide) never
  // loads, so its `decode()` neither resolves nor rejects — and `document.fonts.ready` can stall on
  // a webfont that never loads. Both run inside `page.evaluate`, which has no timeout, so without a
  // cap a single such element hangs the entire capture indefinitely.
  const withCap = <T>(p: Promise<T> | null, ms: number): Promise<T | void> =>
    Promise.race([p ?? Promise.resolve(), sleep(ms)]);

  scrollTargetTo(target, maxScrollOf(target)); // jump to bottom to trigger lazy content
  await sleep(Math.max(0, args.settleMs));
  try {
    await withCap(document.fonts?.ready ?? null, 5000);
  } catch {
    /* no font set */
  }
  try {
    const imgs = Array.from(document.images ?? []);
    // Decode every image, but bound the whole batch — a real decode is sub-second; a stuck lazy/
    // never-loading image would otherwise hang here forever (see `withCap` above).
    await withCap(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Promise.all(imgs.map((im: any) => (im.decode ? im.decode().catch(() => {}) : null))),
      4000,
    );
  } catch {
    /* decode unsupported */
  }
  scrollTargetTo(target, 0); // back to the top for the animated pass
  await sleep(50);

  // --- inlined, self-contained scroll helpers (duplicated in pageScroll; see note above) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findScrollTarget(doc: any, gcs: (el: any) => { overflowY: string }): unknown {
    const se = doc.scrollingElement || doc.documentElement;
    if (se && se.scrollHeight - se.clientHeight > 1) return se;
    let best: unknown = null;
    let bestArea = 0;
    const all = doc.querySelectorAll("*");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      let oy = "";
      try {
        oy = gcs(el).overflowY;
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
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function isDocTarget(t: any): boolean {
    return (
      t === (document.scrollingElement || document.documentElement) ||
      t === document.documentElement ||
      t === document.body
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function scrollTargetTo(t: any, y: number): void {
    if (isDocTarget(t)) window.scrollTo({ top: y, left: 0, behavior: "instant" });
    else if (t.scrollTo) t.scrollTo({ top: y, left: 0, behavior: "instant" });
    else t.scrollTop = y;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function maxScrollOf(t: any): number {
    return Math.max(0, t.scrollHeight - t.clientHeight);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function forceInstant(t: any): void {
    try {
      document.documentElement.style.scrollBehavior = "auto";
    } catch {
      /* ignore */
    }
    try {
      if (t && t.style) t.style.scrollBehavior = "auto";
    } catch {
      /* ignore */
    }
  }
}

/**
 * Runs INSIDE the page. Auto-detects the page's section boundaries as normalized scroll positions
 * (0..1), sorted ascending and deduped, with the bottom (1) always included. Uses an explicit selector
 * when given, else a heuristic (<section>, direct children of <main>, [data-section]) filtered to
 * elements at least `minHeightFraction` of the viewport tall. Returns [] for a non-scrollable page.
 * Self-contained (serialized via page.evaluate).
 */
export async function detectSectionOffsets(args: DetectSectionsArgs): Promise<number[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const target = findScrollTarget(document, getComputedStyle) as any;
  const distance = maxScrollOf(target);
  if (distance <= 0) return [];
  const docTarget = isDocTarget(target);
  const vh = window.innerHeight || document.documentElement.clientHeight || 1;
  const containerTop = docTarget ? 0 : target.getBoundingClientRect().top;
  const curScroll = docTarget
    ? window.pageYOffset || document.documentElement.scrollTop || 0
    : target.scrollTop;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let els: any[] = [];
  try {
    els = Array.from(
      document.querySelectorAll(args.selector || "section, main > *, [data-section]"),
    );
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
    // Apply the height filter only to the heuristic; trust an explicit selector verbatim.
    if (!args.selector && rect.height < minH) continue;
    const rawTop = docTarget ? rect.top + curScroll : rect.top - containerTop + curScroll;
    // Pull the target up by the sticky/fixed header height so the section isn't clipped under it.
    const top = rawTop - (args.headerInsetPx ?? 0);
    const y = Math.max(0, Math.min(distance, top));
    offsets.push(y / distance);
  }
  offsets.sort((a, b) => a - b);
  const deduped: number[] = [];
  for (const o of offsets) {
    if (deduped.length === 0 || o - deduped[deduped.length - 1]! > 0.01) deduped.push(o);
  }
  // Always end the reel at the bottom.
  if (deduped.length === 0 || deduped[deduped.length - 1]! < 0.99) deduped.push(1);
  return deduped.slice(0, args.maxSections);

  // --- inlined, self-contained scroll helpers (duplicated elsewhere in this file; see note above) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findScrollTarget(doc: any, gcs: (el: any) => { overflowY: string }): unknown {
    const se = doc.scrollingElement || doc.documentElement;
    if (se && se.scrollHeight - se.clientHeight > 1) return se;
    let best: unknown = null;
    let bestArea = 0;
    const all = doc.querySelectorAll("*");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      let oy = "";
      try {
        oy = gcs(el).overflowY;
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
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function isDocTarget(t: any): boolean {
    return (
      t === (document.scrollingElement || document.documentElement) ||
      t === document.documentElement ||
      t === document.body
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function maxScrollOf(t: any): number {
    return Math.max(0, t.scrollHeight - t.clientHeight);
  }
}

/**
 * Runs INSIDE the page. Resolves CSS selectors to normalized scroll positions (0..1) on the real scroll
 * target — used by choreography to "scroll to a section". Returns null for a selector that matches no
 * element. Measured once after warm-up (positions are stable), so all workers agree. Self-contained.
 */
export async function measureNormalizedOffsets(
  args: MeasureOffsetsArgs,
): Promise<Array<number | null>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const target = findScrollTarget(document, getComputedStyle) as any;
  const distance = maxScrollOf(target);
  const docTarget = isDocTarget(target);
  const containerTop = docTarget ? 0 : target.getBoundingClientRect().top;
  const curScroll = docTarget
    ? window.pageYOffset || document.documentElement.scrollTop || 0
    : target.scrollTop;
  return args.selectors.map((sel) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let el: any = null;
    try {
      el = document.querySelector(sel);
    } catch {
      el = null;
    }
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const rawTop = docTarget ? rect.top + curScroll : rect.top - containerTop + curScroll;
    // Pull the target up by the sticky/fixed header height so the selector lands below it, not under it.
    const offsetTop = rawTop - (args.headerInsetPx ?? 0);
    const y = Math.max(0, Math.min(distance, offsetTop));
    return distance > 0 ? y / distance : 0;
  });

  // --- inlined, self-contained scroll helpers (duplicated elsewhere in this file; see note above) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findScrollTarget(doc: any, gcs: (el: any) => { overflowY: string }): unknown {
    const se = doc.scrollingElement || doc.documentElement;
    if (se && se.scrollHeight - se.clientHeight > 1) return se;
    let best: unknown = null;
    let bestArea = 0;
    const all = doc.querySelectorAll("*");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      let oy = "";
      try {
        oy = gcs(el).overflowY;
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
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function isDocTarget(t: any): boolean {
    return (
      t === (document.scrollingElement || document.documentElement) ||
      t === document.documentElement ||
      t === document.body
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function maxScrollOf(t: any): number {
    return Math.max(0, t.scrollHeight - t.clientHeight);
  }
}

/**
 * Runs INSIDE the page. Measures how far a sticky/fixed header intrudes from the top of the viewport
 * (px) so scroll targets can be pulled up by it — otherwise a scrolled-to section lands UNDER the
 * header and looks clipped. Probe-scrolls down one viewport so a `position: sticky` header is actually
 * pinned, takes the lowest bottom edge among wide, top-anchored fixed/sticky elements, then restores
 * the scroll. Returns 0 when there's no such header. Self-contained (serialized via page.evaluate).
 */
export async function measureTopInset(args: MeasureTopInsetArgs): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const target = findScrollTarget(document, getComputedStyle) as any;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const maxFraction = args.maxFraction ?? 0.4;
  const distance = maxScrollOf(target);
  const cur = isDocTarget(target)
    ? window.pageYOffset || document.documentElement.scrollTop || 0
    : target.scrollTop;
  // Pin any top-sticky header by scrolling past its natural position, then settle one frame.
  scrollTargetTo(target, Math.min(cur + vh, distance));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  let inset = 0;
  try {
    const all = document.querySelectorAll("body *");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      let position = "";
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        position = (getComputedStyle(el) as any).position;
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
      // A header pinned to the top: starts at the very top, spans most of the width, isn't a
      // full-screen overlay, and reaches lower than anything found so far.
      if (
        r.top <= 2 &&
        r.width >= vw * 0.6 &&
        r.height > 0 &&
        r.bottom > inset &&
        r.bottom <= vh * maxFraction
      ) {
        inset = r.bottom;
      }
    }
  } catch {
    /* ignore */
  }
  scrollTargetTo(target, cur); // restore the original scroll
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return inset;

  // --- inlined, self-contained scroll helpers (duplicated elsewhere in this file; see note above) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findScrollTarget(doc: any, gcs: (el: any) => { overflowY: string }): unknown {
    const se = doc.scrollingElement || doc.documentElement;
    if (se && se.scrollHeight - se.clientHeight > 1) return se;
    let best: unknown = null;
    let bestArea = 0;
    const all = doc.querySelectorAll("*");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      let oy = "";
      try {
        oy = gcs(el).overflowY;
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
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function isDocTarget(t: any): boolean {
    return (
      t === (document.scrollingElement || document.documentElement) ||
      t === document.documentElement ||
      t === document.body
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function scrollTargetTo(t: any, y: number): void {
    if (isDocTarget(t)) window.scrollTo({ top: y, left: 0, behavior: "instant" });
    else if (t.scrollTo) t.scrollTo({ top: y, left: 0, behavior: "instant" });
    else t.scrollTop = y;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function maxScrollOf(t: any): number {
    return Math.max(0, t.scrollHeight - t.clientHeight);
  }
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
 * real slice of capture time. Must be self-contained (serialized via page.evaluate); helpers are
 * inlined as elsewhere in this file.
 */
export async function seekFrame(args: SeekFrameArgs): Promise<void> {
  // 1. Scroll-seek (same semantics as seekScrollTo).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const target = findScrollTarget(document, getComputedStyle) as any;
  forceInstant(target);
  const distance = maxScrollOf(target);
  const clamped = args.normalizedY < 0 ? 0 : args.normalizedY > 1 ? 1 : args.normalizedY;
  scrollTargetTo(target, clamped * distance);
  // Two rAF ticks: let scroll handlers run (frame 1) and the resulting paint commit (frame 2).
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  // 2. Settle in-view content (fonts + visible image decode), each await capped at settleMaxMs.
  if (args.settleMaxMs != null) {
    const maxMs = args.settleMaxMs;
    const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(() => resolve(), ms));
    const withCap = <T>(p: Promise<T> | null): Promise<T | void> =>
      Promise.race([p ?? Promise.resolve(), sleep(maxMs)]);
    try {
      await withCap(document.fonts?.ready ?? null);
    } catch {
      /* no font set */
    }
    try {
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imgs = Array.from(document.images ?? []) as any[];
      const inView = imgs.filter((im) => {
        try {
          const r = im.getBoundingClientRect();
          return r.bottom > 0 && r.top < vh && r.width > 0 && r.height > 0;
        } catch {
          return false;
        }
      });
      await withCap(
        Promise.all(inView.map((im) => (im.decode ? im.decode().catch(() => {}) : null))),
      );
    } catch {
      /* decode unsupported */
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  // --- inlined, self-contained scroll helpers (duplicated elsewhere in this file; see note above) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findScrollTarget(doc: any, gcs: (el: any) => { overflowY: string }): unknown {
    const se = doc.scrollingElement || doc.documentElement;
    if (se && se.scrollHeight - se.clientHeight > 1) return se;
    let best: unknown = null;
    let bestArea = 0;
    const all = doc.querySelectorAll("*");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      let oy = "";
      try {
        oy = gcs(el).overflowY;
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
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function isDocTarget(t: any): boolean {
    return (
      t === (document.scrollingElement || document.documentElement) ||
      t === document.documentElement ||
      t === document.body
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function scrollTargetTo(t: any, y: number): void {
    if (isDocTarget(t)) window.scrollTo({ top: y, left: 0, behavior: "instant" });
    else if (t.scrollTo) t.scrollTo({ top: y, left: 0, behavior: "instant" });
    else t.scrollTop = y;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function maxScrollOf(t: any): number {
    return Math.max(0, t.scrollHeight - t.clientHeight);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function forceInstant(t: any): void {
    try {
      document.documentElement.style.scrollBehavior = "auto";
    } catch {
      /* ignore */
    }
    try {
      if (t && t.style) t.style.scrollBehavior = "auto";
    } catch {
      /* ignore */
    }
  }
}

