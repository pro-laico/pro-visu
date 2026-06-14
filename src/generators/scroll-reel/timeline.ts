import { EASINGS, type EasingName } from "@/generators/scroll-reel/scroll";

/**
 * A pure, frame-accurate model of how a recording's scroll position moves over time. This is the
 * extensibility seam for cinematic features: the default is still a single eased top→bottom sweep with
 * start/end dwell, but the same `ScrollSegment[]` shape can express pause-on-section choreography,
 * multiple eased segments, and speed ramps without another capture-side refactor.
 *
 * Positions are NORMALIZED (0 = top, 1 = bottom). The actual scrollable distance is only known
 * in-page after warm-up, so the capture layer multiplies `scrollAt(t)` by the measured distance. Keeping
 * the model normalized is what makes it a pure Node function (unit-testable like the easings) and lets
 * parallel workers agree: each re-measures the same distance after the same deterministic warm-up.
 */
export interface ScrollSegment {
  /** Normalized scroll position at the segment's start (0..1). */
  fromY: number;
  /** Normalized scroll position at the segment's end (0..1). A hold has `fromY === toY`. */
  toY: number;
  /** Fraction of the whole clip this segment occupies (0..1). All fractions sum to 1. */
  durationFraction: number;
  easing: EasingName;
}

export interface TimelineSpec {
  segments: ScrollSegment[];
}

export interface ResolvedTimeline {
  /** Normalized scroll position (0..1) at clip-time `tSeconds`. */
  scrollAt: (tSeconds: number) => number;
  totalSeconds: number;
}

export interface DefaultTimelineArgs {
  startDelayMs: number;
  durationMs: number;
  endDwellMs: number;
  easing: EasingName;
}

/**
 * The current scroll-reel behavior expressed as a timeline: hold at top, eased scroll 0→1, hold at
 * bottom. The dwells become HELD FRAMES — the frame-stepped equivalent of the realtime path's
 * `sleep(startDelayMs)` / `sleep(endDwellMs)` — so the clip is exactly `startDelay + duration + endDwell`
 * long, matching the manifest `durationMs`.
 */
export function defaultTimelineSpec(a: DefaultTimelineArgs): TimelineSpec {
  const total = a.startDelayMs + a.durationMs + a.endDwellMs;
  if (total <= 0) {
    return { segments: [{ fromY: 0, toY: 0, durationFraction: 1, easing: "linear" }] };
  }
  const segments: ScrollSegment[] = [];
  if (a.startDelayMs > 0) {
    segments.push({ fromY: 0, toY: 0, durationFraction: a.startDelayMs / total, easing: "linear" });
  }
  if (a.durationMs > 0) {
    segments.push({ fromY: 0, toY: 1, durationFraction: a.durationMs / total, easing: a.easing });
  }
  if (a.endDwellMs > 0) {
    segments.push({ fromY: 1, toY: 1, durationFraction: a.endDwellMs / total, easing: "linear" });
  }
  // All-zero durations are guarded above, but keep a defined fallback for safety.
  if (segments.length === 0) {
    segments.push({ fromY: 0, toY: 0, durationFraction: 1, easing: "linear" });
  }
  return { segments };
}

/**
 * Pure: the normalized scroll position at progress `p` (0..1 over the whole clip). Walks the segments,
 * applies the segment's easing to its local progress, and lerps `fromY → toY`. The last segment owns
 * `p === 1` so floating-point fraction sums can't fall through.
 */
export function normalizedScrollAt(spec: TimelineSpec, p: number): number {
  const clamped = p < 0 ? 0 : p > 1 ? 1 : p;
  let acc = 0;
  for (let i = 0; i < spec.segments.length; i++) {
    const seg = spec.segments[i];
    if (!seg) continue;
    const segEnd = acc + seg.durationFraction;
    const isLast = i === spec.segments.length - 1;
    if (clamped <= segEnd || isLast) {
      const local = seg.durationFraction > 0 ? (clamped - acc) / seg.durationFraction : 1;
      const lc = local < 0 ? 0 : local > 1 ? 1 : local;
      const eased = EASINGS[seg.easing](lc);
      return seg.fromY + (seg.toY - seg.fromY) * eased;
    }
    acc = segEnd;
  }
  const last = spec.segments[spec.segments.length - 1];
  return last ? last.toY : 0;
}

/** Bind a spec to a wall-clock length, yielding `scrollAt(tSeconds)`. */
export function resolveTimeline(spec: TimelineSpec, totalSeconds: number): ResolvedTimeline {
  return {
    totalSeconds,
    scrollAt: (tSeconds: number) =>
      normalizedScrollAt(spec, totalSeconds > 0 ? tSeconds / totalSeconds : 1),
  };
}

export function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// --- choreography (pause-on-section / keyframe scrolling) ---

/** Default per-step travel time when a choreography step omits `durationMs`. */
export const DEFAULT_STEP_DURATION_MS = 1200;
/** Default per-step hold time when a choreography step omits `holdMs`. */
export const DEFAULT_STEP_HOLD_MS = 800;

/** An authored choreography step (raw, before targets are resolved to a position). */
export interface ChoreographyStep {
  /** Where to scroll to: a normalized 0..1 number, an "NN%" string, or a CSS selector to bring into view. */
  to: number | string;
  /** Time to travel to this target (ms). Defaults to {@link DEFAULT_STEP_DURATION_MS}. */
  durationMs?: number;
  /** Time to hold at this target after arriving (ms). Defaults to {@link DEFAULT_STEP_HOLD_MS}. */
  holdMs?: number;
  easing?: EasingName;
}

/** A choreography step whose target has been resolved to a normalized position. */
export interface ResolvedChoreographyStep {
  toY: number;
  durationMs: number;
  holdMs: number;
  easing: EasingName;
}

export interface ChoreographyTimelineArgs {
  startDelayMs: number;
  endDwellMs: number;
  steps: ResolvedChoreographyStep[];
}

/**
 * Build a timeline from resolved choreography: an initial hold at the top, then for each step a travel
 * segment (eased) to its target followed by an optional hold, then a final dwell. A hold is a segment
 * with `fromY === toY`, so `normalizedScrollAt` keeps it pinned — exactly the "pause on a section"
 * behavior. The fractions are derived from each segment's ms over the total, so the clip length matches
 * {@link scrollTimelineTotalMs} computed from the same step timings.
 */
export function choreographyTimelineSpec(a: ChoreographyTimelineArgs): TimelineSpec {
  let total = a.startDelayMs + a.endDwellMs;
  for (const s of a.steps) total += s.durationMs + s.holdMs;
  if (total <= 0) {
    return { segments: [{ fromY: 0, toY: 0, durationFraction: 1, easing: "linear" }] };
  }
  const segments: ScrollSegment[] = [];
  let fromY = 0;
  if (a.startDelayMs > 0) {
    segments.push({ fromY: 0, toY: 0, durationFraction: a.startDelayMs / total, easing: "linear" });
  }
  for (const s of a.steps) {
    if (s.durationMs > 0) {
      segments.push({ fromY, toY: s.toY, durationFraction: s.durationMs / total, easing: s.easing });
    }
    if (s.holdMs > 0) {
      segments.push({ fromY: s.toY, toY: s.toY, durationFraction: s.holdMs / total, easing: "linear" });
    }
    fromY = s.toY;
  }
  if (a.endDwellMs > 0) {
    segments.push({ fromY, toY: fromY, durationFraction: a.endDwellMs / total, easing: "linear" });
  }
  if (segments.length === 0) {
    segments.push({ fromY: 0, toY: fromY, durationFraction: 1, easing: "linear" });
  }
  return { segments };
}

export interface ScrollTimelineTotalArgs {
  startDelayMs: number;
  duration: number;
  endDwellMs: number;
  choreography?: Array<{ durationMs?: number; holdMs?: number }>;
}

/**
 * Pure: total clip length in ms. With choreography it's the start delay + end dwell + each step's
 * (travel + hold), applying the per-step defaults; otherwise the classic startDelay + duration +
 * endDwell. The capture layer and the manifest's `durationMs` both use this so they always agree.
 */
export function scrollTimelineTotalMs(o: ScrollTimelineTotalArgs): number {
  if (!o.choreography || o.choreography.length === 0) {
    return o.startDelayMs + o.duration + o.endDwellMs;
  }
  let total = o.startDelayMs + o.endDwellMs;
  for (const s of o.choreography) {
    total += (s.durationMs ?? DEFAULT_STEP_DURATION_MS) + (s.holdMs ?? DEFAULT_STEP_HOLD_MS);
  }
  return total;
}
