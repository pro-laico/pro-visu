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

// --- auto-section detection (auto-generated choreography) ---

/** Default total clip length (ms) for an auto-section reel. */
export const DEFAULT_AUTO_DURATION_MS = 12000;
/** Default hold (ms) at each detected section. */
export const DEFAULT_AUTO_HOLD_MS = 700;
/** Default minimum element height (as a fraction of the viewport) to count as a section. */
export const DEFAULT_AUTO_MIN_HEIGHT_FRACTION = 0.5;
/** Default cap on the number of detected sections (keeps clips a reasonable length). */
export const DEFAULT_AUTO_MAX_SECTIONS = 8;

export interface AutoSectionsConfig {
  minHeightFraction?: number;
  selector?: string;
  holdMs?: number;
  /** Total clip length in ms (the budget split across detected sections). */
  durationMs?: number;
  maxSections?: number;
  constantVelocity?: boolean;
}

/** The total clip length (ms) for an auto-section config — a fixed, page-independent budget. */
export function autoSectionsBudgetMs(cfg: boolean | AutoSectionsConfig): number {
  const c = typeof cfg === "object" ? cfg : {};
  return c.durationMs ?? DEFAULT_AUTO_DURATION_MS;
}

export interface AutoSectionStepsArgs {
  /** Detected section positions, normalized 0..1, sorted ascending. */
  offsets: number[];
  /** Total clip budget in ms (== autoSectionsBudgetMs). */
  budgetMs: number;
  startDelayMs: number;
  endDwellMs: number;
  holdMs: number;
  /** Distribute travel time by distance so scroll speed is uniform. */
  constantVelocity: boolean;
  easing: EasingName;
}

/**
 * Pure: turn detected section offsets into choreography steps that fit exactly into `budgetMs`. The
 * start delay and end dwell are reserved; the remainder is split into a hold at each section plus travel
 * between them. With `constantVelocity`, travel time is proportional to the distance covered (uniform
 * scroll speed); otherwise it's split evenly. Holds are capped so travel always has time. Returns []
 * when there are no offsets (the caller falls back to a default sweep).
 */
export function autoSectionSteps(a: AutoSectionStepsArgs): ResolvedChoreographyStep[] {
  const n = a.offsets.length;
  if (n === 0) return [];
  const remaining = Math.max(0, a.budgetMs - a.startDelayMs - a.endDwellMs);
  let holdEach = a.holdMs;
  if (holdEach * n > remaining * 0.7) holdEach = (remaining * 0.7) / n;
  const travelTotal = Math.max(0, remaining - holdEach * n);

  let prev = 0;
  const dists = a.offsets.map((o) => {
    const d = Math.max(0, o - prev);
    prev = o;
    return d;
  });
  const sumD = dists.reduce((s, d) => s + d, 0);
  const useVelocity = a.constantVelocity && sumD > 0;

  const steps: ResolvedChoreographyStep[] = [];
  let usedTravel = 0;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const weight = useVelocity ? dists[i]! / sumD : 1 / n;
    // Last step absorbs any rounding so travel sums exactly to travelTotal.
    const travel = isLast ? travelTotal - usedTravel : travelTotal * weight;
    usedTravel += travel;
    steps.push({
      toY: clamp01(a.offsets[i]!),
      durationMs: Math.max(0, travel),
      holdMs: holdEach,
      easing: a.easing,
    });
  }
  return steps;
}

export interface ScrollTimelineTotalArgs {
  startDelayMs: number;
  durationMs: number;
  endDwellMs: number;
  choreography?: Array<{ durationMs?: number; holdMs?: number }>;
  autoSections?: boolean | AutoSectionsConfig;
}

/**
 * Pure: total clip length in ms. Explicit choreography wins; then auto-sections use their fixed budget;
 * otherwise the classic startDelay + duration + endDwell. The capture layer and the manifest's
 * `durationMs` both use this so they always agree.
 */
export function scrollTimelineTotalMs(o: ScrollTimelineTotalArgs): number {
  if (o.choreography && o.choreography.length > 0) {
    let total = o.startDelayMs + o.endDwellMs;
    for (const s of o.choreography) {
      total += (s.durationMs ?? DEFAULT_STEP_DURATION_MS) + (s.holdMs ?? DEFAULT_STEP_HOLD_MS);
    }
    return total;
  }
  if (o.autoSections) {
    return autoSectionsBudgetMs(o.autoSections);
  }
  return o.startDelayMs + o.durationMs + o.endDwellMs;
}

// --- loop / boomerang ---

/**
 * Pure: mirror a spec so it plays forward then backward within the same total length — a seamless
 * loop (last frame ≈ first). Each segment's fraction is halved; the second half is the segments in
 * reverse with swapped endpoints. Exactly time-symmetric for symmetric easings (linear/ease-in-out-*);
 * for asymmetric easings the down/up acceleration differs slightly but the loop is still seamless.
 */
export function boomerangSpec(spec: TimelineSpec): TimelineSpec {
  const forward = spec.segments.map((s) => ({ ...s, durationFraction: s.durationFraction / 2 }));
  const backward = spec.segments
    .slice()
    .reverse()
    .map((s) => ({
      fromY: s.toY,
      toY: s.fromY,
      durationFraction: s.durationFraction / 2,
      easing: s.easing,
    }));
  return { segments: [...forward, ...backward] };
}

