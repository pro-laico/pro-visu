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
 * Vertical scroll offset for a column at clip-time t, in px, already wrapped into [0, period).
 * Completes `loopsY` whole cycles over D, so offset(D) ≡ offset(0) ≡ 0 — a seamless loop.
 */
export function offsetY(loopsY: number, dir: Dir, t: number, durationSeconds: number, period: number): number {
  if (period <= 0 || durationSeconds <= 0) return 0;
  const raw = dir * loopsY * period * (t / durationSeconds);
  return mod(raw, period);
}

/**
 * Global horizontal pan offset at clip-time t, in px, wrapped into [0, period). `panLoops` whole
 * cycles over D (0 = no pan); `dir` is the pan direction.
 */
export function offsetX(panLoops: number, dir: Dir, t: number, durationSeconds: number, period: number): number {
  if (period <= 0 || durationSeconds <= 0 || panLoops <= 0) return 0;
  const raw = dir * panLoops * period * (t / durationSeconds);
  return mod(raw, period);
}

/** Positive modulo (JS `%` keeps the sign of the dividend). */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}
