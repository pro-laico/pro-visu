import { describe, expect, it } from "vitest";
import {
  autoColumns,
  evalIcons,
  makeGrid,
  stepPhases,
  type BaseState,
  type EffectStep,
} from "../scene-app/src/scenes/icons-timeline";

const BASE: BaseState = { color: "#ffffff", scale: 1, opacity: 1 };
const DUR = 8;

describe("icons-timeline: grid", () => {
  it("wraps a count into a near-square grid and derives rows", () => {
    const g = makeGrid(9, 3);
    expect(g).toEqual({ count: 9, columns: 3, rows: 3 });
    // A non-multiple count rounds rows up.
    expect(makeGrid(10, 3).rows).toBe(4);
    // Columns are clamped to [1, count].
    expect(makeGrid(4, 99).columns).toBe(4);
    expect(makeGrid(4, 0).columns).toBe(1);
  });

  it("auto-picks columns from count + frame aspect", () => {
    // 16 icons in a square frame → 4×4.
    expect(autoColumns(16, 1080, 1080)).toBe(4);
    // A wide frame biases toward more columns.
    expect(autoColumns(16, 1920, 1080)).toBeGreaterThan(4);
    expect(autoColumns(1, 1000, 1000)).toBe(1);
  });
});

describe("icons-timeline: phases", () => {
  const grid = makeGrid(9, 3);

  it("forward order spreads phase 0→1 across icons in index order", () => {
    const step: EffectStep = { kind: "scale", at: 0, span: 1, order: "forward" };
    const phases = stepPhases(step, 0, grid, 1);
    expect(phases[0]).toBeCloseTo(0);
    expect(phases[8]).toBeCloseTo(1);
    // Monotonic non-decreasing.
    for (let i = 1; i < phases.length; i++) expect(phases[i]!).toBeGreaterThanOrEqual(phases[i - 1]!);
  });

  it("groups icons that share an ordering score (diagonal fires as a wave)", () => {
    const step: EffectStep = { kind: "scale", at: 0, span: 1, order: "diagonal" };
    const phases = stepPhases(step, 0, grid, 1);
    // Icons on the same anti-diagonal (row+col equal) share a phase: idx1 (0,1) and idx3 (1,0).
    expect(phases[1]!).toBeCloseTo(phases[3]!);
  });

  it("excludes non-participating icons with a -1 sentinel", () => {
    const step: EffectStep = { kind: "color", at: 0, span: 1, targets: "checkerboard" };
    const phases = stepPhases(step, 0, grid, 1);
    // (row+col) even participates; index 1 is (0,1) → odd → excluded.
    expect(phases[0]!).toBeGreaterThanOrEqual(0);
    expect(phases[1]).toBe(-1);
  });
});

describe("icons-timeline: evaluation", () => {
  const grid = makeGrid(9, 3);

  it("is deterministic (same inputs → identical states, incl. random order)", () => {
    const steps: EffectStep[] = [
      { kind: "scale", at: 0.1, span: 0.8, order: "random", scale: 1.5 },
    ];
    const a = evalIcons(steps, 3.3, DUR, grid, BASE, 7);
    const b = evalIcons(steps, 3.3, DUR, grid, BASE, 7);
    expect(a).toEqual(b);
  });

  it("rests at base at t=0 for a return step that starts after 0", () => {
    const steps: EffectStep[] = [
      { kind: "scale", at: 0.2, span: 0.6, order: "forward", scale: 2, return: true },
    ];
    const states = evalIcons(steps, 0, DUR, grid, BASE, 1);
    for (const s of states) {
      expect(s.scale).toBeCloseTo(1);
      expect(s.color).toBe("#ffffff");
    }
  });

  it("a return step reaches its peak mid-slice then comes back to base by the end", () => {
    // Single icon, simultaneous (stagger 0), no hold → clean triangular bump peaking at the middle.
    const g = makeGrid(1, 1);
    const steps: EffectStep[] = [
      { kind: "scale", at: 0, span: 1, order: "forward", stagger: 0, scale: 2, hold: 0, easing: "linear" },
    ];
    expect(evalIcons(steps, DUR * 0.5, DUR, g, BASE, 1)[0]!.scale).toBeCloseTo(2);
    expect(evalIcons(steps, DUR, DUR, g, BASE, 1)[0]!.scale).toBeCloseTo(1);
  });

  it("latches (return:false) and holds the target after the slice ends", () => {
    const g = makeGrid(1, 1);
    const steps: EffectStep[] = [
      { kind: "color", at: 0, span: 0.5, order: "forward", stagger: 0, color: "#000000", return: false },
    ];
    // Well after the slice, the colour stays fully switched.
    expect(evalIcons(steps, DUR * 0.9, DUR, g, BASE, 1)[0]!.color).toBe("#000000");
  });

  it("only recolours the targeted pattern", () => {
    const steps: EffectStep[] = [
      { kind: "color", at: 0, span: 1, stagger: 0, targets: "checkerboard", color: "#000000", hold: 1 },
    ];
    const states = evalIcons(steps, DUR * 0.5, DUR, grid, BASE, 1);
    expect(states[0]!.color).toBe("#000000"); // (0,0) even → recoloured
    expect(states[1]!.color).toBe("#ffffff"); // (0,1) odd → untouched
  });

  it("folds steps in order so effects layer (scale + colour together)", () => {
    const g = makeGrid(1, 1);
    const steps: EffectStep[] = [
      { kind: "scale", at: 0, span: 1, stagger: 0, scale: 1.8, hold: 1 },
      { kind: "color", at: 0, span: 1, stagger: 0, color: "#112233", hold: 1 },
    ];
    const s = evalIcons(steps, DUR * 0.5, DUR, g, BASE, 1)[0]!;
    expect(s.scale).toBeCloseTo(1.8);
    expect(s.color).toBe("#112233");
  });

  it("spins a whole number of turns back to the start angle (seamless)", () => {
    const g = makeGrid(1, 1);
    const steps: EffectStep[] = [
      { kind: "spin", at: 0, span: 1, stagger: 0, turns: 1, easing: "linear" },
    ];
    // Half-way: ~180°.
    expect(evalIcons(steps, DUR * 0.5, DUR, g, BASE, 1)[0]!.rotate).toBeCloseTo(180);
    // End of slice: a full 360° (≡ 0 visually).
    expect(evalIcons(steps, DUR, DUR, g, BASE, 1)[0]!.rotate).toBeCloseTo(360);
  });
});
