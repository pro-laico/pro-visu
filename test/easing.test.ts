import { describe, expect, it } from "vitest";
import { EASINGS } from "@/generators/scroll-reel/scroll";

describe("easing functions", () => {
  it("map endpoints 0 -> 0 and 1 -> 1", () => {
    for (const fn of Object.values(EASINGS)) {
      expect(fn(0)).toBeCloseTo(0);
      expect(fn(1)).toBeCloseTo(1);
    }
  });

  it("have the expected midpoints", () => {
    expect(EASINGS.linear(0.5)).toBeCloseTo(0.5);
    expect(EASINGS.easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(EASINGS.easeInOutQuad(0.25)).toBeCloseTo(0.125);
    expect(EASINGS.easeOutCubic(0.5)).toBeCloseTo(0.875);
    expect(EASINGS.easeInOutSine(0.5)).toBeCloseTo(0.5);
    expect(EASINGS.easeOutQuint(0.5)).toBeCloseTo(1 - Math.pow(0.5, 5));
    expect(EASINGS.easeInOutExpo(0.5)).toBeCloseTo(0.5);
  });

  it("stay within [0,1] and never decrease", () => {
    for (const fn of Object.values(EASINGS)) {
      let prev = -Infinity;
      for (let t = 0; t <= 1; t += 0.1) {
        const v = fn(t);
        expect(v).toBeGreaterThanOrEqual(-1e-6);
        expect(v).toBeLessThanOrEqual(1 + 1e-6);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-6);
        prev = v;
      }
    }
  });
});
