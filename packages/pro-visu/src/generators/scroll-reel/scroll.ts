export type EasingName =
  | "linear"
  | "ease-in-out-cubic"
  | "ease-in-out-quad"
  | "ease-out-cubic"
  | "ease-in-out-sine"
  | "ease-in-out-expo"
  | "ease-out-quint";

/**
 * Pure easing functions, t in [0,1] -> [0,1]. Unit-tested on the Node side; the formula inside
 * `pageScroll` below MUST stay in sync with these.
 */
export const EASINGS: Record<EasingName, (t: number) => number> = {
  linear: (t) => t,
  "ease-in-out-cubic": (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  "ease-in-out-quad": (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  "ease-out-cubic": (t) => 1 - Math.pow(1 - t, 3),
  "ease-in-out-sine": (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  "ease-in-out-expo": (t) =>
    t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? Math.pow(2, 20 * t - 10) / 2
          : (2 - Math.pow(2, -20 * t + 10)) / 2,
  "ease-out-quint": (t) => 1 - Math.pow(1 - t, 5),
};

export interface PageScrollArgs {
  durationMs: number;
  easing: EasingName;
  startDelayMs: number;
  endDwellMs: number;
}

export interface PrepareScrollArgs {
  /** How long to wait at the bottom for lazy/below-the-fold content to load (ms). */
  settleMs: number;
}

export interface SeekScrollArgs {
  /** Normalized scroll position to jump to (0 = top, 1 = bottom). */
  normalizedY: number;
  /** Optional Ken Burns zoom scale for this frame (omit for no zoom). */
  scale?: number;
  /** Zoom origin X within the viewport (0 = left, 1 = right). Default 0.5. */
  originX?: number;
  /** Zoom origin Y within the viewport (0 = top, 1 = bottom). Default 0.5. */
  originY?: number;
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

/**
 * Runs INSIDE the page. Waits for the CURRENT scroll position's in-view content to be ready — fonts
 * loaded and visible images decoded — then yields one animation frame. Bounded by the caller (a
 * Node-side timeout) so a stuck decode can't hang a frame. Self-contained (serialized via page.evaluate).
 */
export async function settleInView(): Promise<void> {
  try {
    await (document.fonts?.ready ?? Promise.resolve());
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
    await Promise.all(inView.map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
  } catch {
    /* decode unsupported */
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Runs INSIDE the page. Jumps the real scroll target to a normalized position (0 = top, 1 = bottom)
 * instantly, then waits TWO animation frames so scroll-linked animations, IntersectionObserver reveals,
 * and `position: sticky` elements recompute and PAINT before the caller screenshots. This is the
 * frame-stepped counterpart to `pageScroll`: the capture layer calls it once per frame with the
 * timeline's position for that frame, so the resulting video is frame-accurate and reproducible. Must be
 * self-contained (serialized via page.evaluate); the scroll helpers are inlined as elsewhere in this file.
 */
export async function seekScrollTo(args: SeekScrollArgs): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const target = findScrollTarget(document, getComputedStyle) as any;
  forceInstant(target);
  const distance = maxScrollOf(target);
  const clamped = args.normalizedY < 0 ? 0 : args.normalizedY > 1 ? 1 : args.normalizedY;
  scrollTargetTo(target, clamped * distance);
  // Ken Burns: scale the page toward a viewport-anchored origin (computed from the live scroll), so
  // the zoom centers on what's on screen. Only touched when a scale is supplied.
  if (typeof args.scale === "number") {
    try {
      const vw = window.innerWidth || document.documentElement.clientWidth || 0;
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      const sx = window.pageXOffset || 0;
      const sy = window.pageYOffset || document.documentElement.scrollTop || 0;
      const ox = sx + (args.originX ?? 0.5) * vw;
      const oy = sy + (args.originY ?? 0.5) * vh;
      const body = document.body;
      if (body && body.style) {
        body.style.transformOrigin = `${ox}px ${oy}px`;
        body.style.transform = `scale(${args.scale})`;
      }
    } catch {
      /* ignore */
    }
  }
  // Two rAF ticks: let scroll handlers run (frame 1) and the resulting paint commit (frame 2).
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  // --- inlined, self-contained scroll helpers (duplicated in prepareScroll/pageScroll; see note above) ---
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
 * Runs INSIDE the page. Smoothly scrolls the real scroll target top -> bottom over `durationMs`
 * using requestAnimationFrame, with a dwell before and after. Forces instant per-frame positioning
 * so a site's `scroll-behavior: smooth` can't fight the animation, and targets the actual scroll
 * container (not just the window) so app-shell layouts scroll too. Returns the scrolled distance in
 * px (0 = nothing scrollable was found — the caller can warn).
 */
export async function pageScroll(args: PageScrollArgs): Promise<number> {
  const { durationMs, easing, startDelayMs, endDwellMs } = args;

  const ease = (t: number): number => {
    switch (easing) {
      case "ease-in-out-cubic":
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      case "ease-in-out-quad":
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case "ease-out-cubic":
        return 1 - Math.pow(1 - t, 3);
      case "ease-in-out-sine":
        return -(Math.cos(Math.PI * t) - 1) / 2;
      case "ease-in-out-expo":
        return t === 0
          ? 0
          : t === 1
            ? 1
            : t < 0.5
              ? Math.pow(2, 20 * t - 10) / 2
              : (2 - Math.pow(2, -20 * t + 10)) / 2;
      case "ease-out-quint":
        return 1 - Math.pow(1 - t, 5);
      default:
        return t;
    }
  };
  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(() => resolve(), ms));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const target = findScrollTarget(document, getComputedStyle) as any;
  forceInstant(target);

  scrollTargetTo(target, 0);
  await sleep(startDelayMs);

  // Snapshot the scroll distance once so lazy content loading mid-scroll can't move the goalpost.
  const distance = maxScrollOf(target);
  if (distance > 0) {
    await new Promise<void>((resolve) => {
      let start: number | null = null;
      const step = (now: number): void => {
        if (start === null) start = now;
        const t = Math.min(1, (now - start) / durationMs);
        scrollTargetTo(target, ease(t) * distance);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  await sleep(endDwellMs);
  return distance;

  // --- inlined, self-contained scroll helpers (duplicated in prepareScroll; see note above) ---
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
