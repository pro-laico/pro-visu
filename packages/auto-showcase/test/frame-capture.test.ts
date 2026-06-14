import { describe, expect, it } from "vitest";
import { autoWorkers, planFrames } from "@/media/frame-capture";

describe("planFrames", () => {
  it("returns a single range when workers is 1", () => {
    expect(planFrames(100, 1)).toEqual([{ start: 0, end: 100 }]);
  });

  it("tiles [0, totalFrames) with contiguous, non-overlapping ranges that cover everything", () => {
    const ranges = planFrames(100, 4);
    expect(ranges[0]?.start).toBe(0);
    expect(ranges.at(-1)?.end).toBe(100);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i]?.start).toBe(ranges[i - 1]?.end);
    }
    const covered = ranges.reduce((n, r) => n + (r.end - r.start), 0);
    expect(covered).toBe(100);
  });

  it("handles a remainder that does not divide evenly", () => {
    // chunk = ceil(10/3) = 4 → [0,4) [4,8) [8,10)
    expect(planFrames(10, 3)).toEqual([
      { start: 0, end: 4 },
      { start: 4, end: 8 },
      { start: 8, end: 10 },
    ]);
  });

  it("caps workers at totalFrames and never produces empty ranges", () => {
    const ranges = planFrames(3, 8);
    expect(ranges).toHaveLength(3);
    for (const r of ranges) expect(r.end).toBeGreaterThan(r.start);
  });

  it("clamps workers below 1 to a single range", () => {
    expect(planFrames(5, 0)).toEqual([{ start: 0, end: 5 }]);
  });
});

describe("autoWorkers", () => {
  it("returns between 1 and 6 inclusive", () => {
    const w = autoWorkers();
    expect(w).toBeGreaterThanOrEqual(1);
    expect(w).toBeLessThanOrEqual(6);
  });
});
