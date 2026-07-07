/**
 * The palette-reel's reveal animation as pure, DOM-free data + functions, so that:
 *  - state is a function of time (`expansionWeights(t)`), letting the capture runtime seek the scene
 *    to any frame instead of replaying wall-clock timers;
 *  - it is DETERMINISTIC with NO randomness — every weight is a closed-form function of `t` and the
 *    timing knobs, so the parallel frame-stepper's independent browser contexts agree exactly;
 *  - the logic is unit-testable from Node (see test/palette-reel-timeline.test.ts).
 *
 * The model is a continuous sweep: exactly one color is open at a time (the rest are name-only
 * slivers), and the open band crossfades smoothly into the NEXT one. Each color holds open for
 * `holdSeconds`, then hands off over `transitionSeconds`. By default the sweep `bounce`s — it runs
 * down the list then back up (0→…→last→…→1→0) — so every handoff is between adjacent bands and the
 * open region only ever slides by one; this avoids the "pinch" you get when the open band has to jump
 * from the last color (bottom) back to the first (top) across the whole stack. With `bounce` off the
 * sweep wraps directly (last→first), which is shorter but crossfades non-adjacent bands at the seam.
 * Either way t=0 sits at color 0 fully open and the cycle returns there, so position(t=D) ≡
 * position(0): a seamless loop with no mirror.
 */

export type Easing =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "ease-out-strong"
  | "ease-in-out-strong";

/** Timing for the sweep. All durations are seconds. */
export interface ReelTimingParams {
  /** Number of colors. */
  count: number;
  /** How long each color stays fully open before handing off. */
  holdSeconds: number;
  /** Crossfade length from one open color to the next. */
  transitionSeconds: number;
  /** Easing applied to the crossfade ramp. */
  easing: Easing;
  /** Ping-pong the sweep (down then back up) so every handoff is between neighbours — no end "pinch". */
  bounce: boolean;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Easing curve mapping a 0..1 ramp fraction to an eased 0..1. The curves are higher-order than the
 * usual quadratics for a smoother feel — cubic in/out and a quintic smootherstep for ease-in-out
 * (zero velocity at both ends, so a crossfade eases out of one hold and into the next with no jerk).
 */
export function ease(u: number, e: Easing): number {
  const x = clamp01(u);
  switch (e) {
    case "ease-in":
      return x * x * x; // cubic, front-loaded
    case "ease-out": {
      const y = 1 - x;
      return 1 - y * y * y; // cubic, back-loaded
    }
    case "ease-in-out":
      return x * x * x * (x * (x * 6 - 15) + 10); // smootherstep (quintic)
    case "ease-out-strong":
      return 1 - Math.pow(1 - x, 5); // quintic, back-loaded
    case "ease-in-out-strong":
      return x < 0.5 ? 16 * Math.pow(x, 5) : 1 - Math.pow(-2 * x + 2, 5) / 2; // quintic in-out
    default:
      return x; // "linear"
  }
}

/** One color's footprint on the timeline: its hold plus the handoff that follows it. */
export function cycleSeconds(p: ReelTimingParams): number {
  return p.holdSeconds + p.transitionSeconds;
}

/** Number of "stops" (held colors) in one loop: a bounce visits the middle colors twice. */
export function stopCount(p: ReelTimingParams): number {
  const n = Math.max(0, Math.floor(p.count));
  if (n <= 1) return n;
  return p.bounce ? 2 * (n - 1) : n;
}

/** The color index held at stop `k` — a triangle wave when bouncing, a plain cycle when wrapping. */
function stopColor(k: number, n: number, bounce: boolean): number {
  if (!bounce) return ((k % n) + n) % n;
  const period = 2 * (n - 1);
  const m = ((k % period) + period) % period;
  return m < n ? m : period - m; // 0,1,…,n-1,n-2,…,1
}

/** Total clip length: every stop holds once and hands off once. Seam wraps cleanly to t=0. */
export function totalDuration(p: ReelTimingParams): number {
  return stopCount(p) * cycleSeconds(p);
}

/**
 * The expansion weight (0..1) of every color at absolute time `t` — the scene maps these to flex-grow
 * and text reveal. Exactly one color is fully open during a hold; during a handoff the outgoing and
 * incoming colors crossfade (their weights sum to 1), so the frame is always filled by one band's
 * worth of openness and never collapses to all-slivers. Length is always `count`.
 */
export function expansionWeights(t: number, p: ReelTimingParams): number[] {
  const n = Math.max(0, Math.floor(p.count));
  const weights = new Array<number>(n).fill(0);
  if (n === 0) return weights;
  if (n === 1) {
    weights[0] = 1;
    return weights;
  }

  const stops = stopCount(p);
  const cycle = cycleSeconds(p);
  const total = stops * cycle;
  let tt = t % total;
  if (tt < 0) tt += total;

  const k = Math.min(stops - 1, Math.floor(tt / cycle));
  const local = tt - k * cycle;
  const cur = stopColor(k, n, p.bounce);

  if (local <= p.holdSeconds || p.transitionSeconds <= 0) {
    weights[cur] = 1; // holding fully open
  } else {
    const e = ease((local - p.holdSeconds) / p.transitionSeconds, p.easing);
    const next = stopColor(k + 1, n, p.bounce);
    weights[cur] = 1 - e; // outgoing collapses
    weights[next] = e; // incoming (an adjacent band, when bouncing) opens
  }
  return weights;
}
