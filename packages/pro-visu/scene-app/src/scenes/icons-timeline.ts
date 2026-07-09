/**
 * The icon-grid's animation as pure, DOM-free functions. An icon grid is a set of uniform,
 * mask-tinted icons laid out in a `columns`×`rows` grid; the animation is a list of "effect steps"
 * evaluated to a per-icon {scale, color, opacity, rotate} state at any clip-time. It's a pure
 * function of time — published via `window.__sceneSeek(t)` — so the frame-stepper renders it
 * frame-exact (and a single frame at one time is the still-image output).
 *
 * One primitive drives every preset interaction. A step sweeps an effect across the icons: its
 * `order` decides each icon's PHASE (0..1) across the grid (forward, a diagonal, a ripple from the
 * centre, …), and `stagger` decides how much of the step's time window that phase spreads over —
 * `stagger: 0` fires every targeted icon at once (a pattern flash), `stagger: 1` walks them
 * one-at-a-time. So "scale one at a time", "recolour one at a time", and "recolour many in a
 * pattern" are all the same primitive with different `order`/`stagger`. Steps fold in order, so they
 * compose into richer, layered motion.
 */

export type Easing =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "ease-out-strong"
  | "ease-in-out-strong";

/** What an effect step animates. */
export type EffectKind = "scale" | "color" | "opacity" | "rotate" | "spin";

/** How a step's phase sweeps across the grid (which icon "goes" when). */
export type Order =
  | "forward"
  | "reverse"
  | "random"
  | "rows"
  | "columns"
  | "diagonal"
  | "radial-in"
  | "radial-out"
  | "spiral";

/** Which icons a step touches. `checkerboard`/`even`/`odd`/`rows-alt`/`cols-alt` recolour a pattern. */
export type Targets = "all" | "even" | "odd" | "checkerboard" | "rows-alt" | "cols-alt";

/** One eased sweep of an effect across the grid — the single motion primitive (see file header). */
export interface EffectStep {
  /** What to animate. */
  kind: EffectKind;
  /** When the step starts, as a fraction of the clip (0..1). */
  at: number;
  /** How long the step lasts, as a fraction of the clip (0..1). */
  span: number;
  /** Sweep order across the grid (each icon's phase). Default "forward". */
  order?: Order;
  /** How much of `span` the phase spreads over: 0 = all at once (pattern), 1 = one-at-a-time. Default 0.6. */
  stagger?: number;
  /** Which icons participate. Default "all". */
  targets?: Targets;
  /** Easing of each icon's ramp. Default "ease-in-out". */
  easing?: Easing;
  /** Bounce back to the base state by the end of the icon's slice (true) or latch at the target (false). Default true. */
  return?: boolean;
  /** Fraction of each icon's slice held at the peak before it returns (0..1). Default 0.3. Ignored when `return` is false. */
  hold?: number;
  /** Scales the effect's strength (0..1). Default 1. */
  intensity?: number;
  /** scale: target size multiplier (1 = base). Default 1.6. */
  scale?: number;
  /** color: target colour (any hex / rgb()). */
  color?: string;
  /** opacity: target opacity (0..1). Default 1. */
  opacity?: number;
  /** rotate: target angle in degrees. Default 90. */
  angle?: number;
  /** spin: full turns over the icon's slice. Default 1. */
  turns?: number;
}

/** A resolved per-icon visual state. */
export interface IconState {
  scale: number;
  color: string;
  opacity: number;
  rotate: number;
}

/** Grid geometry: `count` icons wrapped into `columns` (rows derived). */
export interface Grid {
  count: number;
  columns: number;
  rows: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Same easing vocabulary as the rest of the tool (base curves cubic, "strong" quintic). */
const EASES: Record<Easing, (x: number) => number> = {
  linear: (x) => x,
  "ease-in": (x) => x * x * x,
  "ease-out": (x) => 1 - Math.pow(1 - x, 3),
  "ease-in-out": (x) => (x < 0.5 ? 4 * x ** 3 : 1 - Math.pow(-2 * x + 2, 3) / 2),
  "ease-out-strong": (x) => 1 - Math.pow(1 - x, 5),
  "ease-in-out-strong": (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
};

function ease(x: number, e: Easing | undefined): number {
  return (EASES[e ?? "ease-in-out"] ?? EASES["ease-in-out"])(clamp(x, 0, 1));
}

/** mulberry32 — tiny seedable PRNG; same seed ⇒ same sequence in every context and in Node tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wrap `count` icons into a grid of `columns` (≥1); rows = ceil(count / columns). */
export function makeGrid(count: number, columns: number): Grid {
  const cols = Math.max(1, Math.min(columns, Math.max(1, count)));
  return { count, columns: cols, rows: Math.max(1, Math.ceil(count / cols)) };
}

/**
 * Auto column count for `count` icons in a `w`×`h` frame. Picks the grid whose aspect best matches
 * the frame's (log-ratio distance), nudged toward the option that leaves the fewest orphans (empty
 * cells in the last row) and, on ties, toward landscape. So a square frame of 16 → 4×4, of 10 → 4×3.
 */
export function autoColumns(count: number, w: number, h: number): number {
  if (count <= 1) return 1;
  const target = Math.log(w > 0 && h > 0 ? w / h : 1);
  let best = 1;
  let bestScore = Infinity;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const orphans = (cols - (count % cols)) % cols; // empty cells in the last row
    const score =
      Math.abs(Math.log(cols / rows) - target) + orphans * 0.06 - (cols >= rows ? 1e-4 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = cols;
    }
  }
  return best;
}

/** Grid coordinates for an icon: logical `row`/`col`, plus visual `vx`/`vy` (a short final row is
 *  centred, so `vx` shifts by half the empty span). Geometric orders + the scene render use vx/vy. */
export interface Pos {
  row: number;
  col: number;
  vx: number;
  vy: number;
}

/** Per-icon positions, with the last partial row centred (its `vx` shifted by half the empty span). */
export function positions(grid: Grid): Pos[] {
  const lastRow = grid.rows - 1;
  const lastRowCount = grid.count - lastRow * grid.columns;
  const lastOffset = lastRowCount < grid.columns ? (grid.columns - lastRowCount) / 2 : 0;
  const out: Pos[] = [];
  for (let i = 0; i < grid.count; i++) {
    const row = Math.floor(i / grid.columns);
    const col = i % grid.columns;
    out.push({ row, col, vx: col + (row === lastRow ? lastOffset : 0), vy: row });
  }
  return out;
}

/** Does icon `i` (at `p`) participate in a step targeting `targets`? */
function participates(i: number, p: Pos, targets: Targets): boolean {
  switch (targets) {
    case "even":
      return i % 2 === 0;
    case "odd":
      return i % 2 === 1;
    case "checkerboard":
      return (p.row + p.col) % 2 === 0;
    case "rows-alt":
      return p.row % 2 === 0;
    case "cols-alt":
      return p.col % 2 === 0;
    default:
      return true;
  }
}

/**
 * Raw ordering score per icon for an `order`. Icons sharing a score fire TOGETHER (so `diagonal`
 * reads as a diagonal wave and `radial-*` as a ring ripple), which is exactly the "pattern" look.
 * `random` is seeded so every render agrees.
 */
function orderScore(order: Order, i: number, p: Pos, grid: Grid, rng: () => number): number {
  const cr = (grid.rows - 1) / 2;
  const cc = (grid.columns - 1) / 2;
  // Geometric orders read from the VISUAL position (vx/vy) so a ripple/diagonal tracks the centred
  // layout — a lone final-row icon sits under the middle, not the corner.
  const dist = Math.hypot(p.vy - cr, p.vx - cc);
  switch (order) {
    case "reverse":
      return -i;
    case "rows":
      return p.row;
    case "columns":
      return p.col;
    case "diagonal":
      return p.vy + p.vx;
    case "radial-out":
      return dist;
    case "radial-in":
      return -dist;
    case "spiral":
      // Rings outward, ordered by angle within each ring.
      return dist + (Math.atan2(p.vy - cr, p.vx - cc) + Math.PI) / (2 * Math.PI);
    case "random":
      return rng();
    default:
      return i;
  }
}

/**
 * Per-icon phase in [0,1] for a step: its ordering score normalised across the PARTICIPATING icons.
 * Non-participants get `phase = -1` (a sentinel meaning "excluded"). A random order is seeded per
 * (step index, base seed) so different steps scatter differently but reproducibly.
 */
export function stepPhases(
  step: EffectStep,
  stepIndex: number,
  grid: Grid,
  seed: number,
): number[] {
  const pos = positions(grid);
  const targets = step.targets ?? "all";
  const rng = mulberry32((seed >>> 0) ^ (0x9e3779b9 * (stepIndex + 1)));
  const scores = pos.map((p, i) =>
    participates(i, p, targets) ? orderScore(step.order ?? "forward", i, p, grid, rng) : NaN,
  );
  const real = scores.filter((s) => !Number.isNaN(s));
  const min = real.length ? Math.min(...real) : 0;
  const max = real.length ? Math.max(...real) : 0;
  const range = max - min;
  return scores.map((s) => (Number.isNaN(s) ? -1 : range > 1e-9 ? (s - min) / range : 0));
}

/**
 * One icon's activation envelope for a step at clip-progress `u` (0..1), given its `phase`. Returns
 * 0..1. In `return` mode it's an eased bump (up → hold → down) confined to the icon's slice, so the
 * icon ends back at base. In latch mode it's a monotone 0→1 ramp that stays at 1 after the slice.
 */
function envelope(step: EffectStep, u: number, phase: number): number {
  if (phase < 0) return 0; // excluded icon
  const s = clamp(step.stagger ?? 0.6, 0, 0.98);
  const span = Math.max(1e-4, step.span);
  const d = Math.max(1e-4, span * (1 - s)); // per-icon slice length
  const start = step.at + phase * s * span;
  const x = (u - start) / d; // local progress within the icon's slice
  const returns = step.return !== false;
  if (x <= 0) return 0;
  if (x >= 1) return returns ? 0 : 1;
  if (!returns) return ease(x, step.easing);
  const hold = clamp(step.hold ?? 0.3, 0, 1);
  const ramp = (1 - hold) / 2;
  if (ramp <= 1e-6) return 1;
  if (x < ramp) return ease(x / ramp, step.easing);
  if (x <= ramp + hold) return 1;
  return ease((1 - x) / ramp, step.easing);
}

// --- colour parsing / mixing (hex + rgb()/rgba() → sRGB lerp) -------------------------------------

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseColor(c: string): Rgb | null {
  const s = c.trim();
  const hex = s.replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const [r, g, b] = [hex.slice(0, 1), hex.slice(1, 2), hex.slice(2, 3)];
    return { r: parseInt(r + r, 16), g: parseInt(g + g, 16), b: parseInt(b + b, 16) };
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m?.[1]) {
    const [r, g, b] = m[1].split(",").map((p) => parseFloat(p));
    if (r !== undefined && g !== undefined && b !== undefined && [r, g, b].every(Number.isFinite)) {
      return { r, g, b };
    }
  }
  return null;
}

/**
 * Mix `from`→`to` by `t` (0..1) in sRGB. If either colour can't be parsed (e.g. a CSS keyword), fall
 * back to a hard switch at the midpoint so unparseable colours still animate sensibly.
 */
function mixColor(from: string, to: string, t: number): string {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const a = parseColor(from);
  const b = parseColor(to);
  if (!a || !b) return t < 0.5 ? from : to;
  const r = Math.round(lerp(a.r, b.r, t));
  const g = Math.round(lerp(a.g, b.g, t));
  const bl = Math.round(lerp(a.b, b.b, t));
  return `rgb(${r}, ${g}, ${bl})`;
}

/** The base (resting) state every icon starts from before steps fold in. */
export interface BaseState {
  color: string;
  scale?: number;
  opacity?: number;
}

/**
 * Evaluate every icon's state at clip-time `t` (seconds). Starts from `base` and folds each step in
 * order, so overlapping steps layer (a colour sweep during a scale ripple, etc.). Pure and
 * deterministic — the same (steps, t, grid, seed) always yields the same states.
 */
export function evalIcons(
  steps: EffectStep[],
  t: number,
  durationSeconds: number,
  grid: Grid,
  base: BaseState,
  seed: number,
): IconState[] {
  const u = durationSeconds > 0 ? clamp(t / durationSeconds, 0, 1) : 0;
  // Precompute each step's per-icon phases once (independent of t).
  const phases = steps.map((step, si) => stepPhases(step, si, grid, seed));

  const out: IconState[] = [];
  for (let i = 0; i < grid.count; i++) {
    const state: IconState = {
      scale: base.scale ?? 1,
      color: base.color,
      opacity: base.opacity ?? 1,
      rotate: 0,
    };
    for (let si = 0; si < steps.length; si++) {
      const step = steps[si];
      if (!step) continue;
      const phase = phases[si]?.[i] ?? -1;
      const e = envelope(step, u, phase) * clamp(step.intensity ?? 1, 0, 1);
      if (e <= 0 && step.kind !== "spin") continue;
      switch (step.kind) {
        case "scale":
          state.scale = lerp(state.scale, step.scale ?? 1.6, e);
          break;
        case "opacity":
          state.opacity = lerp(state.opacity, step.opacity ?? 1, e);
          break;
        case "rotate":
          state.rotate = lerp(state.rotate, step.angle ?? 90, e);
          break;
        case "color":
          state.color = mixColor(state.color, step.color ?? state.color, e);
          break;
        case "spin": {
          // Spin uses a monotone 0→1 progress (not a bump) so it turns through cleanly; a whole
          // number of turns lands back on the start angle, so it's seamless regardless of `return`.
          if (phase < 0) break;
          const s = clamp(step.stagger ?? 0.6, 0, 0.98);
          const span = Math.max(1e-4, step.span);
          const d = Math.max(1e-4, span * (1 - s));
          const x = clamp((u - (step.at + phase * s * span)) / d, 0, 1);
          state.rotate += (step.turns ?? 1) * 360 * ease(x, step.easing) * clamp(step.intensity ?? 1, 0, 1);
          break;
        }
      }
    }
    out.push(state);
  }
  return out;
}
