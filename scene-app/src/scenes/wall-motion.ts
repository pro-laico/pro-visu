/**
 * The media-wall's layout + motion as pure, DOM-free functions, so that:
 *  - motion is a deterministic function of time (X pan + per-column Y scroll), which the
 *    frame-stepper can seek; and the per-column speed variation is seeded so every parallel
 *    frame-worker computes the identical wall.
 *  - the seamless-loop property is unit-testable (offset(D) ≡ offset(0) modulo the period).
 */
import { mulberry32 } from "./specimen-timeline";

export { mulberry32 };

export type Dir = 1 | -1;

export interface ColumnPlan {
  /** Integer vertical cycles over the clip → the column's scroll speed. */
  loopsY: number;
  /** Scroll direction (+1 down, -1 up). */
  dir: Dir;
}

export interface PlanColumnsOptions {
  scrollLoopsMin: number;
  scrollLoopsMax: number;
  /** Alternate scroll direction per column for a livelier wall. */
  alternate: boolean;
}

/**
 * Per-column motion plan: an integer vertical cycle count (the speed — varying per column so the
 * wall feels orchestrated rather than uniform) plus a direction. Deterministic given the seed.
 * Integer cycles are what make each column loop seamlessly over the clip.
 */
export function planColumns(
  seed: number,
  columns: number,
  opts: PlanColumnsOptions,
): ColumnPlan[] {
  const rng = mulberry32(seed);
  const lo = Math.max(1, Math.min(opts.scrollLoopsMin, opts.scrollLoopsMax));
  const hi = Math.max(opts.scrollLoopsMin, opts.scrollLoopsMax);
  const span = hi - lo + 1;
  return Array.from({ length: Math.max(1, columns) }, (_, i) => ({
    loopsY: lo + Math.floor(rng() * span),
    dir: (opts.alternate && i % 2 === 1 ? -1 : 1) as Dir,
  }));
}

/**
 * Which input slot fills each tile: `columns × tilesPerColumn`, cycling the input keys with a
 * per-column offset so adjacent columns don't line up. Deterministic; no randomness needed.
 */
export function assignTiles(
  inputKeys: string[],
  columns: number,
  tilesPerColumn: number,
): string[][] {
  const keys = inputKeys.length ? inputKeys : [""];
  const cols = Math.max(1, columns);
  const per = Math.max(1, tilesPerColumn);
  // Index = c·(per+1) + r: within a column the row advances by 1 (so a column holds `per` distinct
  // keys when there are enough), and the per-column stagger of `per+1` shifts each column's window
  // — independent of `cols`, so it never collapses (the old `r·cols` term zeroed out when cols was
  // a multiple of keys.length, making whole columns one image).
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: per }, (_, r) => keys[(c * (per + 1) + r) % keys.length] as string),
  );
}

/** Wrap a time into a video's [0, duration) so short clips loop instead of freezing. */
export function loopTime(t: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return t;
  const m = t % duration;
  return m < 0 ? m + duration : m;
}

/**
 * How the wall moves over time: mostly passive (held or a slow creep), punctuated by brief,
 * heavy-ease-in-out "pulses". This is what lets the loop stay seamless (motion still completes a
 * whole number of cycles, so offset(D) ≡ offset(0)) while *feeling* slow — the speed lives almost
 * entirely inside the short pulses.
 */
export interface MotionParams {
  durationSeconds: number;
  /** Pulses over the clip (each a quick eased move; holds between). */
  pulses: number;
  /** Length of each pulse's eased ramp, in seconds (~1 = a brisk one-second burst). */
  pulseDuration: number;
  /** 0 = fully held (frozen) between pulses; 1 = constant linear drift (no pulse character). */
  baseDrift: number;
  /**
   * Relative size of each pulse (length === `pulses`). Omit for uniform pulses; provide seeded
   * weights (see {@link makePulseWeights}) so some pulses move more than others — the organic,
   * non-uniform cadence real reference walls have. The weights sum is normalized, so the total
   * travel (and the seamless-loop math) is unchanged.
   */
  pulseWeights?: number[];
}

/** Seeded per-pulse size weights in [1-variance, 1+variance]. variance 0 ⇒ uniform pulses. */
export function makePulseWeights(seed: number, pulses: number, variance: number): number[] {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const v = Math.min(1, Math.max(0, variance));
  return Array.from({ length: Math.max(1, Math.round(pulses)) }, () => 1 + (rng() * 2 - 1) * v);
}

/** Heavy ease-in-out (quintic) — a strong hold at both ends, fast through the middle. */
function easeInOutHeavy(x: number): number {
  return x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2;
}

/**
 * Eased staircase progress 0→1: `pulses` equal time-segments, each holding then ramping up by a
 * step (centered in the segment) over `pulseDuration` seconds with a heavy ease. At u=1 it's exactly
 * 1, so the motion that scales it lands back on the loop point.
 */
function staircase(u: number, mp: MotionParams): number {
  const pulses = Math.max(1, Math.round(mp.pulses));
  const weights =
    mp.pulseWeights && mp.pulseWeights.length === pulses
      ? mp.pulseWeights
      : Array.from({ length: pulses }, () => 1);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const seg = 1 / pulses;
  const i = Math.min(pulses - 1, Math.floor(u / seg));
  const local = (u - i * seg) / seg; // [0,1) within this segment
  const width = Math.min(1, Math.max(0.02, mp.pulseDuration / (mp.durationSeconds / pulses)));
  const rampStart = (1 - width) / 2;
  const x = (local - rampStart) / width;
  const r = x <= 0 ? 0 : x >= 1 ? 1 : easeInOutHeavy(x);
  // Cumulative weight before this pulse + this pulse's eased step. At u=1, r=1 on the last pulse ⇒
  // the sum of all weights / total = 1, so the loop-seam math (offset(D) ≡ offset(0)) is preserved.
  let before = 0;
  for (let k = 0; k < i; k++) before += weights[k] as number;
  return (before + (weights[i] as number) * r) / total;
}

/** Eased progress 0→1 over the clip: a blend of a slow linear creep and the pulse staircase. */
export function easeProgress(t: number, mp: MotionParams): number {
  if (mp.durationSeconds <= 0) return 0;
  const u = Math.min(1, Math.max(0, t / mp.durationSeconds));
  const drift = Math.min(1, Math.max(0, mp.baseDrift));
  return drift * u + (1 - drift) * staircase(u, mp);
}

/**
 * Offset along one axis (px), wrapped into [0, period). `cycles` whole periods are traversed over
 * the clip — but delivered via {@link easeProgress}, so the wall sits mostly still and the travel
 * happens in brief pulses. `cycles · easeProgress(D) = cycles` (integer) ⇒ offset(D) ≡ offset(0).
 */
export function axisOffset(
  cycles: number,
  dir: Dir,
  t: number,
  period: number,
  mp: MotionParams,
): number {
  if (period <= 0 || cycles <= 0 || mp.durationSeconds <= 0) return 0;
  return mod(dir * cycles * easeProgress(t, mp) * period, period);
}

/** Positive modulo (JS `%` keeps the sign of the dividend). */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}
