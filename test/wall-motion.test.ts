import { describe, expect, it } from "vitest";
import {
  assignTiles,
  loopTime,
  offsetX,
  offsetY,
  planColumns,
  type Dir,
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

describe("offset loop-seam (the core seamless-loop property)", () => {
  const D = 12;
  const period = 740;

  it("offsetY returns to its t=0 value at t=D for every column plan", () => {
    const dirs: Dir[] = [1, -1];
    for (const dir of dirs) {
      for (const loopsY of [1, 2, 3, 7]) {
        const at0 = offsetY(loopsY, dir, 0, D, period);
        const atD = offsetY(loopsY, dir, D, D, period);
        expect(at0).toBeCloseTo(0, 6);
        expect(atD).toBeCloseTo(0, 6); // ≡ offset(0) → no seam
      }
    }
  });

  it("offsetX returns to its t=0 value at t=D (and is 0 when panLoops=0)", () => {
    expect(offsetX(1, 1, D, D, period)).toBeCloseTo(0, 6);
    expect(offsetX(2, -1, D, D, period)).toBeCloseTo(0, 6);
    expect(offsetX(0, 1, D / 2, D, period)).toBe(0); // no pan
  });

  it("offset is monotonic-ish within a cycle (moves off zero mid-clip)", () => {
    const mid = offsetY(2, 1, D / 4, D, period); // quarter clip, 2 cycles → half a cycle in
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(period);
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
