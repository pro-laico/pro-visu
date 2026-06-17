import { describe, expect, it } from "vitest";
import {
  cycleSeconds,
  ease,
  expansionWeights,
  stopCount,
  totalDuration,
  type ReelTimingParams,
} from "../scene-app/src/scenes/palette-reel-timeline";

const params = (over: Partial<ReelTimingParams> = {}): ReelTimingParams => ({
  count: 4,
  holdSeconds: 2,
  transitionSeconds: 0.7,
  easing: "ease-in-out",
  bounce: true,
  ...over,
});

const sum = (a: number[]): number => a.reduce((s, n) => s + n, 0);
const activeIndices = (w: number[]): number[] =>
  w.map((x, i) => (x > 1e-9 ? i : -1)).filter((i) => i >= 0);

describe("palette-reel timeline", () => {
  it("opens on color 0 (others slivers) and loops to the same state", () => {
    for (const bounce of [true, false]) {
      const p = params({ bounce });
      const start = expansionWeights(0, p);
      const end = expansionWeights(totalDuration(p), p);
      expect(start).toHaveLength(p.count);
      expect(start[0]).toBe(1);
      expect(sum(start)).toBe(1);
      start.slice(1).forEach((w) => expect(w).toBe(0));
      expect(end).toEqual(start); // the seam wraps exactly back to the opening state
    }
  });

  it("is deterministic — identical args give identical output across many t", () => {
    const p = params();
    const d = totalDuration(p);
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * d;
      expect(expansionWeights(t, p)).toEqual(expansionWeights(t, p));
    }
  });

  it("holds exactly one color fully open at the middle of every stop", () => {
    for (const bounce of [true, false]) {
      const p = params({ bounce });
      const cycle = cycleSeconds(p);
      for (let k = 0; k < stopCount(p); k++) {
        const w = expansionWeights(k * cycle + p.holdSeconds / 2, p);
        expect(w.filter((x) => x === 1)).toHaveLength(1);
        expect(sum(w)).toBe(1);
      }
    }
  });

  it("crossfades (sum stays ~1, never all-slivers) for both bounce and wrap", () => {
    for (const bounce of [true, false]) {
      const p = params({ bounce });
      const d = totalDuration(p);
      for (let k = 0; k <= 300; k++) {
        const t = (k / 300) * d;
        expect(sum(expansionWeights(t, p))).toBeCloseTo(1, 6);
      }
    }
  });

  it("bounce only ever crossfades ADJACENT bands (no end pinch)", () => {
    const p = params({ bounce: true });
    const d = totalDuration(p);
    for (let k = 0; k <= 600; k++) {
      const t = (k / 600) * d;
      const active = activeIndices(expansionWeights(t, p));
      expect(active.length).toBeLessThanOrEqual(2);
      if (active.length === 2) {
        expect(Math.abs(active[0]! - active[1]!)).toBe(1); // neighbours only
      }
    }
  });

  it("wrap mode crossfades the non-adjacent last↔first band at the seam (the pinch bounce fixes)", () => {
    const p = params({ bounce: false });
    const cycle = cycleSeconds(p);
    // The final stop hands the last color back to the first — indices n-1 and 0 (non-adjacent).
    const mid = (p.count - 1) * cycle + p.holdSeconds + p.transitionSeconds / 2;
    const active = activeIndices(expansionWeights(mid, p));
    expect(active).toContain(0);
    expect(active).toContain(p.count - 1);
  });

  it("a handoff ramps monotonically (outgoing down, incoming up)", () => {
    const p = params();
    let prevOut = 2;
    let prevIn = -1;
    for (let s = 0; s <= 1; s += 0.05) {
      const t = p.holdSeconds + s * p.transitionSeconds;
      const w = expansionWeights(t, p);
      expect(w[0]).toBeLessThanOrEqual(prevOut + 1e-9);
      expect(w[1]).toBeGreaterThanOrEqual(prevIn - 1e-9);
      prevOut = w[0]!;
      prevIn = w[1]!;
    }
  });

  it("total length: bounce visits middle colors twice, wrap visits each once", () => {
    expect(totalDuration(params({ bounce: true }))).toBeCloseTo(
      2 * (4 - 1) * (2 + 0.7),
      9,
    );
    expect(totalDuration(params({ bounce: false }))).toBeCloseTo(4 * (2 + 0.7), 9);
  });

  it("ease() uses smooth higher-order curves", () => {
    expect(ease(0, "linear")).toBe(0);
    expect(ease(1, "linear")).toBe(1);
    expect(ease(0.5, "ease-in")).toBeCloseTo(0.125, 9); // cubic
    expect(ease(0.5, "ease-out")).toBeCloseTo(0.875, 9);
    expect(ease(0.5, "ease-in-out")).toBeCloseTo(0.5, 9); // smootherstep is symmetric
    // smootherstep has zero slope at the ends (very gentle start/stop).
    expect(ease(0.001, "ease-in-out")).toBeLessThan(0.0001);
    expect(ease(0.999, "ease-in-out")).toBeGreaterThan(0.9999);
    expect(ease(-1, "ease-in-out")).toBe(0);
    expect(ease(2, "ease-in-out")).toBe(1);
  });
});
