import { describe, expect, it } from "vitest";
import {
  assignTiles,
  axisOffset,
  easeProgress,
  loopTime,
  makePulseWeights,
  planColumns,
  type Dir,
  type MotionParams,
} from "../scene-app/src/scenes/wall-motion";

describe("planColumns", () => {
  const opts = { scrollLoopsMin: 2, scrollLoopsMax: 5, alternate: true };

  it("is deterministic per seed and varies the speed across columns", () => {
    const a = planColumns(3, 6, opts);
    const b = planColumns(3, 6, opts);
    expect(a).toEqual(b); // same seed ⇒ identical (parallel workers must agree)
    expect(new Set(a.map((c) => c.loopsY)).size).toBeGreaterThan(1); // speeds vary
    for (const c of a) {
      expect(c.loopsY).toBeGreaterThanOrEqual(2);
      expect(c.loopsY).toBeLessThanOrEqual(5);
    }
  });

  it("alternates direction by column index when enabled, and not when disabled", () => {
    const alt = planColumns(1, 4, opts);
    expect(alt.map((c) => c.dir)).toEqual([1, -1, 1, -1]);
    const uni = planColumns(1, 4, { ...opts, alternate: false });
    expect(uni.every((c) => c.dir === 1)).toBe(true);
  });

  it("differs across seeds", () => {
    expect(planColumns(1, 6, opts)).not.toEqual(planColumns(2, 6, opts));
  });
});

describe("axisOffset loop-seam + pulse character", () => {
  const period = 740;
  const mp: MotionParams = { durationSeconds: 12, pulses: 4, pulseDuration: 1, baseDrift: 0.15 };

  it("returns to its t=0 value at t=D for every cycle count / direction (no seam)", () => {
    const dirs: Dir[] = [1, -1];
    for (const dir of dirs) {
      for (const cycles of [1, 2, 3, 7]) {
        expect(axisOffset(cycles, dir, 0, period, mp)).toBeCloseTo(0, 6);
        expect(axisOffset(cycles, dir, mp.durationSeconds, period, mp)).toBeCloseTo(0, 6);
      }
    }
  });

  it("is 0 when cycles=0 (no motion on that axis)", () => {
    expect(axisOffset(0, 1, mp.durationSeconds / 2, period, mp)).toBe(0);
  });

  it("holds between pulses and moves fast during them (passive, then a burst)", () => {
    // Pure pulses (no base drift): inside the hold of segment 0 the progress barely moves; the ramp
    // (centered in each 3s segment, 1s long → ~[1,2]s) advances much more.
    const held: MotionParams = { ...mp, baseDrift: 0 };
    const holdDelta = easeProgress(0.4, held) - easeProgress(0.1, held); // both inside the hold
    const pulseDelta = easeProgress(1.7, held) - easeProgress(1.3, held); // across the pulse ramp
    expect(holdDelta).toBeLessThan(0.01); // essentially still
    expect(pulseDelta).toBeGreaterThan(holdDelta * 5); // the burst is far faster
  });

  it("easeProgress goes exactly 0→1 over the clip (seam math)", () => {
    expect(easeProgress(0, mp)).toBeCloseTo(0, 6);
    expect(easeProgress(mp.durationSeconds, mp)).toBeCloseTo(1, 6);
  });

  it("varied pulse weights make some pulses bigger, but still end at 1 (seam preserved)", () => {
    const weights = makePulseWeights(3, 4, 0.6);
    expect(weights).toHaveLength(4);
    expect(new Set(weights.map((w) => w.toFixed(3))).size).toBeGreaterThan(1); // not uniform
    const varied: MotionParams = { ...mp, baseDrift: 0, pulseWeights: weights };
    expect(easeProgress(varied.durationSeconds, varied)).toBeCloseTo(1, 6); // seam intact
    // The advance across each pulse differs (organic, non-uniform cadence).
    const steps = [0, 1, 2, 3].map((i) => {
      const seg = varied.durationSeconds / 4;
      return easeProgress(i * seg + seg * 0.85, varied) - easeProgress(i * seg + seg * 0.15, varied);
    });
    expect(Math.max(...steps) - Math.min(...steps)).toBeGreaterThan(0.02);
  });

  it("makePulseWeights is deterministic and uniform at variance 0", () => {
    expect(makePulseWeights(5, 4, 0.6)).toEqual(makePulseWeights(5, 4, 0.6));
    expect(makePulseWeights(5, 4, 0)).toEqual([1, 1, 1, 1]);
  });
});

describe("loopTime", () => {
  it("passes through within duration and wraps beyond it", () => {
    expect(loopTime(3, 5)).toBe(3); // t < dur ⇒ unchanged (existing scenes)
    expect(loopTime(7, 5)).toBeCloseTo(2, 6); // wraps
    expect(loopTime(12, 5)).toBeCloseTo(2, 6);
  });

  it("returns t unchanged for non-finite/zero duration", () => {
    expect(loopTime(4, 0)).toBe(4);
    expect(loopTime(4, NaN)).toBe(4);
    expect(loopTime(4, Infinity)).toBe(4);
  });
});

describe("assignTiles", () => {
  it("fills columns × tilesPerColumn, uses only the given keys, and is deterministic", () => {
    const keys = ["a", "b", "c", "d"];
    const grid = assignTiles(keys, 5, 4);
    expect(grid).toHaveLength(5);
    expect(grid.every((col) => col.length === 4)).toBe(true);
    for (const col of grid) for (const k of col) expect(keys).toContain(k);
    expect(assignTiles(keys, 5, 4)).toEqual(grid); // deterministic
  });

  it("cycles through every input key across the wall", () => {
    const keys = ["a", "b", "c", "d", "e"];
    const used = new Set(assignTiles(keys, 4, 5).flat());
    expect(used).toEqual(new Set(keys));
  });

  it("does not collapse a column to one image when columns is a multiple of the key count", () => {
    // The bug case: 6 columns, 6 keys, 3 tiles each — every column must hold distinct keys.
    const keys = ["a", "b", "c", "d", "e", "f"];
    const grid = assignTiles(keys, 6, 3);
    for (const col of grid) expect(new Set(col).size).toBe(3); // no all-same column
  });

  it("tolerates an empty input list", () => {
    expect(assignTiles([], 2, 2)).toEqual([
      ["", ""],
      ["", ""],
    ]);
  });
});
