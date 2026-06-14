import { describe, expect, it } from "vitest";
import { EASINGS } from "@/generators/scroll-reel/scroll";
import {
  choreographyTimelineSpec,
  defaultTimelineSpec,
  normalizedScrollAt,
  resolveTimeline,
  scrollTimelineTotalMs,
  type TimelineSpec,
} from "@/generators/scroll-reel/timeline";

describe("defaultTimelineSpec", () => {
  const spec = defaultTimelineSpec({
    startDelayMs: 500,
    durationMs: 6000,
    endDwellMs: 800,
    easing: "easeInOutCubic",
  });

  it("produces hold → scroll → hold segments whose fractions sum to 1", () => {
    expect(spec.segments).toHaveLength(3);
    const sum = spec.segments.reduce((s, seg) => s + seg.durationFraction, 0);
    expect(sum).toBeCloseTo(1);
    expect(spec.segments[0]).toMatchObject({ fromY: 0, toY: 0 });
    expect(spec.segments[1]).toMatchObject({ fromY: 0, toY: 1, easing: "easeInOutCubic" });
    expect(spec.segments[2]).toMatchObject({ fromY: 1, toY: 1 });
  });

  it("omits zero-duration dwells", () => {
    const noDwell = defaultTimelineSpec({
      startDelayMs: 0,
      durationMs: 1000,
      endDwellMs: 0,
      easing: "linear",
    });
    expect(noDwell.segments).toHaveLength(1);
    expect(noDwell.segments[0]).toMatchObject({ fromY: 0, toY: 1 });
  });

  it("falls back to a single hold when everything is zero", () => {
    const zero = defaultTimelineSpec({
      startDelayMs: 0,
      durationMs: 0,
      endDwellMs: 0,
      easing: "linear",
    });
    expect(zero.segments).toHaveLength(1);
    expect(zero.segments[0]).toMatchObject({ fromY: 0, toY: 0, durationFraction: 1 });
  });
});

describe("normalizedScrollAt", () => {
  const spec = defaultTimelineSpec({
    startDelayMs: 500,
    durationMs: 6000,
    endDwellMs: 800,
    easing: "easeInOutCubic",
  });
  const total = 500 + 6000 + 800;
  const startFrac = 500 / total;
  const scrollFrac = 6000 / total;
  const endStartFrac = (500 + 6000) / total;

  it("starts at 0 and ends at 1", () => {
    expect(normalizedScrollAt(spec, 0)).toBeCloseTo(0);
    expect(normalizedScrollAt(spec, 1)).toBeCloseTo(1);
  });

  it("holds at the top through the start delay and at the bottom through the end dwell", () => {
    expect(normalizedScrollAt(spec, startFrac * 0.5)).toBeCloseTo(0);
    expect(normalizedScrollAt(spec, startFrac)).toBeCloseTo(0);
    expect(normalizedScrollAt(spec, endStartFrac + (1 - endStartFrac) * 0.5)).toBeCloseTo(1);
  });

  it("applies the scroll segment's easing (not linear) within it", () => {
    const quarter = startFrac + scrollFrac * 0.25;
    expect(normalizedScrollAt(spec, quarter)).toBeCloseTo(EASINGS.easeInOutCubic(0.25));
    // discriminating: a linear ramp would be 0.25 here, the eased value is much smaller.
    expect(normalizedScrollAt(spec, quarter)).toBeLessThan(0.2);
  });

  it("is monotonic non-decreasing and clamps out-of-range progress", () => {
    let prev = -Infinity;
    for (let p = -0.2; p <= 1.2; p += 0.05) {
      const v = normalizedScrollAt(spec, p);
      expect(v).toBeGreaterThanOrEqual(-1e-6);
      expect(v).toBeLessThanOrEqual(1 + 1e-6);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = v;
    }
  });

  it("samples a mid-clip hold constant (the choreography seam)", () => {
    const choreographed: TimelineSpec = {
      segments: [
        { fromY: 0, toY: 0.5, durationFraction: 0.25, easing: "linear" },
        { fromY: 0.5, toY: 0.5, durationFraction: 0.5, easing: "linear" }, // hold mid-page
        { fromY: 0.5, toY: 1, durationFraction: 0.25, easing: "linear" },
      ],
    };
    expect(normalizedScrollAt(choreographed, 0.125)).toBeCloseTo(0.25); // half-way up the first ramp
    expect(normalizedScrollAt(choreographed, 0.3)).toBeCloseTo(0.5);
    expect(normalizedScrollAt(choreographed, 0.5)).toBeCloseTo(0.5);
    expect(normalizedScrollAt(choreographed, 0.7)).toBeCloseTo(0.5);
  });
});

describe("resolveTimeline", () => {
  it("maps clip seconds onto normalized progress", () => {
    const spec = defaultTimelineSpec({
      startDelayMs: 0,
      durationMs: 1000,
      endDwellMs: 0,
      easing: "linear",
    });
    const tl = resolveTimeline(spec, 2);
    expect(tl.totalSeconds).toBe(2);
    expect(tl.scrollAt(0)).toBeCloseTo(0);
    expect(tl.scrollAt(1)).toBeCloseTo(0.5);
    expect(tl.scrollAt(2)).toBeCloseTo(1);
  });

  it("is deterministic for a given t (same input → identical output)", () => {
    const tl = resolveTimeline(
      defaultTimelineSpec({
        startDelayMs: 100,
        durationMs: 900,
        endDwellMs: 200,
        easing: "easeOutCubic",
      }),
      1.2,
    );
    for (const t of [0, 0.137, 0.5, 0.913, 1.2]) {
      expect(tl.scrollAt(t)).toBe(tl.scrollAt(t));
    }
  });
});

describe("choreographyTimelineSpec", () => {
  it("builds hold(start) → [travel, hold]* → dwell(end) with fractions summing to 1", () => {
    const spec = choreographyTimelineSpec({
      startDelayMs: 500,
      endDwellMs: 500,
      steps: [
        { toY: 0.5, durationMs: 1000, holdMs: 1000, easing: "linear" },
        { toY: 1, durationMs: 1000, holdMs: 0, easing: "linear" },
      ],
    });
    const sum = spec.segments.reduce((s, seg) => s + seg.durationFraction, 0);
    expect(sum).toBeCloseTo(1);
    // start-hold, travel→0.5, hold@0.5, travel→1, end-dwell = 5 segments
    expect(spec.segments).toHaveLength(5);
  });

  it("pins each hold and linearly travels between targets", () => {
    const spec = choreographyTimelineSpec({
      startDelayMs: 0,
      endDwellMs: 0,
      steps: [
        { toY: 0.4, durationMs: 1000, holdMs: 1000, easing: "linear" }, // total 3000ms
        { toY: 1, durationMs: 1000, holdMs: 0, easing: "linear" },
      ],
    });
    expect(normalizedScrollAt(spec, 1 / 6)).toBeCloseTo(0.2); // halfway up the first travel
    expect(normalizedScrollAt(spec, 0.5)).toBeCloseTo(0.4); // mid-hold at 0.4
    expect(normalizedScrollAt(spec, 1)).toBeCloseTo(1); // arrived at bottom
  });
});

describe("scrollTimelineTotalMs", () => {
  it("returns startDelay + duration + endDwell without choreography", () => {
    expect(scrollTimelineTotalMs({ startDelayMs: 500, duration: 6000, endDwellMs: 800 })).toBe(7300);
  });

  it("sums choreography steps applying per-step defaults", () => {
    const total = scrollTimelineTotalMs({
      startDelayMs: 0,
      duration: 6000, // ignored when choreography is present
      endDwellMs: 0,
      choreography: [{}, { durationMs: 500, holdMs: 100 }],
    });
    // step1 defaults 1200 + 800 = 2000; step2 500 + 100 = 600 → 2600
    expect(total).toBe(2600);
  });
});
