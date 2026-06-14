export type EasingName = "linear" | "easeInOutCubic" | "easeInOutQuad" | "easeOutCubic";

/**
 * Pure easing functions, t in [0,1] -> [0,1]. Unit-tested on the Node side; the formula inside
 * `pageScroll` below MUST stay in sync with these.
 */
export const EASINGS: Record<EasingName, (t: number) => number> = {
  linear: (t) => t,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
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
}

export interface MeasureOffsetsArgs {
  /** CSS selectors to resolve to normalized scroll positions (0..1). */
  selectors: string[];
}

// Browser globals — declared loosely (no DOM lib in this Node project). The exported functions are
// serialized and run inside the page via page.evaluate, so each must be fully self-contained (no
// references to module-level bindings); the small scroll helpers are therefore inlined in both.
declare const window: {
  scrollTo: (o: { top: number; left: number; behavior: string }) => void;
  innerHeight: number;
  pageYOffset: number;
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

  scrollTargetTo(target, maxScrollOf(target)); // jump to bottom to trigger lazy content
  await sleep(Math.max(0, args.settleMs));
  try {
    await (document.fonts?.ready ?? Promise.resolve());
  } catch {
    /* no font set */
  }
  try {
    const imgs = Array.from(document.images ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await Promise.all(imgs.map((im: any) => (im.decode ? im.decode().catch(() => {}) : null)));
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
    const offsetTop = docTarget ? rect.top + curScroll : rect.top - containerTop + curScroll;
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
      case "easeInOutCubic":
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      case "easeInOutQuad":
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case "easeOutCubic":
        return 1 - Math.pow(1 - t, 3);
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
