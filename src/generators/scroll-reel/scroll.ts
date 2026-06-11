export type EasingName = "linear" | "easeInOutCubic" | "easeInOutQuad" | "easeOutCubic";

/**
 * Pure easing functions, t in [0,1] -> [0,1]. Unit-tested on the Node side; the formulas
 * inside `pageScroll` below MUST stay in sync with these.
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

// Browser globals — declared locally so this stays a Node project (no DOM lib).
declare const window: { scrollTo: (x: number, y: number) => void };
declare const document: { documentElement: { scrollHeight: number; clientHeight: number } };
declare const requestAnimationFrame: (cb: (t: number) => void) => number;

/**
 * Runs INSIDE the page (serialized via page.evaluate), so it must be fully self-contained
 * with no references to module-level bindings. Smoothly scrolls top -> bottom over
 * `durationMs` using requestAnimationFrame, with dwell before and after.
 */
export async function pageScroll(args: PageScrollArgs): Promise<void> {
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
  const maxScroll = (): number =>
    Math.max(0, document.documentElement.scrollHeight - document.documentElement.clientHeight);

  window.scrollTo(0, 0);
  await sleep(startDelayMs);

  if (maxScroll() > 0) {
    await new Promise<void>((resolve) => {
      let start: number | null = null;
      const step = (now: number): void => {
        if (start === null) start = now;
        const t = Math.min(1, (now - start) / durationMs);
        window.scrollTo(0, ease(t) * maxScroll());
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  await sleep(endDwellMs);
}
