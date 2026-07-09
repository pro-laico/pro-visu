/**
 * The media-wall's layout + motion as pure, DOM-free functions. Motion is two independent systems
 * built from the SAME uniform "pulse" primitive, so the wall doesn't move in lockstep:
 *
 *   System 1 — X pan: the whole wall pans horizontally, wrapping seamlessly.
 *   System 2 — per-column Y: each column scrolls on its own, with its own pulses + direction.
 *
 * A track's motion = a continuous base scroll (`loops` whole periods over the clip) PLUS a set of
 * `pulses`. Each pulse is one eased move that adds `distance` periods of travel, starting at `at` and
 * lasting `span` — both 0..1 fractions of the clip. The total travel is rounded UP to a whole
 * number of periods and the remainder is folded into the continuous scroll, so the track lands exactly
 * back on its start at t = durationSeconds → a seamless loop, by construction, for any clip length.
 * Tracks are unit-tested for that seam property. (If `at + span > 1`, the start shifts back so the
 * pulse ends exactly at the loop point — a pulse can never overrun the clip, so the loop always closes.)
 */

export type Dir = 1 | -1;

export type Easing =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "ease-out-strong"
  | "ease-in-out-strong";

/** One eased move that adds `distance` periods of travel at `at`, lasting `span` (clip fractions). */
export interface PulseInput {
  /** When the pulse starts, as a fraction of the clip (0..1). */
  at: number;
  /** How long the move takes, as a fraction of the clip (0..1). */
  span: number;
  /** How far it travels, in periods (1 = one full tile-set / one wrap). Usually 0..1. */
  distance: number;
  /** Easing of the move's ramp. */
  easing?: Easing;
}

/** A resolved motion track: its pulses, its continuous base loops, and its direction sign. */
export interface Track {
  pulses: PulseInput[];
  /** Whole continuous periods over the clip (the baseline scroll); the remainder rounds up. */
  loops: number;
  dir: Dir;
  /** Constant start-position shift, in periods (0..1). A fixed phase offset — preserves the seam. */
  stagger?: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Easing curves, 0→1 — the shared vocabulary (base curves cubic, "strong" quintic). */
const EASES: Record<Easing, (x: number) => number> = {
  linear: (x) => x,
  "ease-in": (x) => x * x * x,
  "ease-out": (x) => 1 - Math.pow(1 - x, 3),
  "ease-in-out": (x) => (x < 0.5 ? 4 * x ** 3 : 1 - Math.pow(-2 * x + 2, 3) / 2),
  "ease-out-strong": (x) => 1 - Math.pow(1 - x, 5),
  "ease-in-out-strong": (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
};

function ease(x: number, e: Easing | undefined): number {
  return (EASES[e ?? "ease-in-out"] ?? EASES["ease-in-out"])(clamp01(x));
}

/**
 * Total travel of a track at time `t`, in periods. The continuous coefficient is chosen so that
 * `continuous + Σ(pulse distances)` is a whole number ≥ `loops` — so travel(D) is an integer and the
 * loop is seamless. Pulses that don't complete by `t` contribute only their eased fraction.
 */
export function trackTravel(pulses: PulseInput[], loops: number, t: number, durationSeconds: number): number {
  const D = durationSeconds;
  if (!(D > 0)) return 0;
  const sumDistance = pulses.reduce((a, p) => a + Math.max(0, p.distance), 0);
  const base = Math.max(0, loops);
  const total = Math.ceil(base + sumDistance - 1e-9);
  const continuous = total - sumDistance;

  const u = clamp01(t / D);
  let traveled = continuous * u;
  for (const p of pulses) {
    const dur = Math.min(1, Math.max(1e-6, p.span));
    const at = Math.min(Math.max(0, p.at), 1 - dur);
    traveled += Math.max(0, p.distance) * ease((u - at) / dur, p.easing);
  }
  return traveled;
}

/**
 * A track's offset (px), wrapped into [0, period). The track's `stagger` adds a constant phase shift
 * (in periods), so columns with similar content don't line up. Seamless: travel(D) is an integer and
 * the stagger is constant ⇒ offset(D) ≡ offset(0).
 */
export function trackOffset(track: Track, t: number, period: number, durationSeconds: number): number {
  if (period <= 0 || durationSeconds <= 0) return 0;
  const travel = track.dir * trackTravel(track.pulses, track.loops, t, durationSeconds);
  return mod((travel + (track.stagger ?? 0)) * period, period);
}

/** Wrap a time into a video's [0, duration) so short clips loop instead of freezing. */
export function loopTime(t: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return t;
  const m = t % duration;
  return m < 0 ? m + duration : m;
}
