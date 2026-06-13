import { describe, expect, it } from "vitest";
import {
  buildEvents,
  buildInitialCells,
  buildSpec,
  classify,
  createCursor,
  mulberry32,
  pulseNameAt,
  totalDuration,
  DEFAULT_WEIGHTS,
  type Cell,
  type Pulse,
} from "../scene-app/src/scenes/specimen-timeline";

/** Fabricated per-glyph advances (no DOM): width grows with code point so classify() has spread. */
function fakeAdvances(pool: string): Record<string, number> {
  const adv: Record<string, number> = {};
  [...pool].forEach((c, i) => (adv[c] = 0.4 + (i % 9) * 0.05));
  return adv;
}

const PULSES: Pulse[] = [
  { name: "hold", duration: 0.5 },
  { name: "letters", duration: 1, chars: 6, pacing: "ease-in-out" },
  { name: "sweep", duration: 1, colors: 8, color: "muted", pacing: "even" },
  { name: "scatter", duration: 1, chars: 3, colors: 3, pacing: "random" },
];

/** Build a full deterministic timeline (spec → classes → cells → events) from a seed. */
function makeTimeline(seed: number, mirror = true) {
  const spec = buildSpec(12, "");
  const classes = classify(spec.pool, fakeAdvances(spec.pool));
  const rng = mulberry32(seed);
  const initial = buildInitialCells(spec.cls, classes, spec.pool, rng);
  const events = buildEvents(PULSES, mirror, spec.cls, classes, initial, 1, 1, DEFAULT_WEIGHTS, rng);
  return { initial, events };
}

describe("mulberry32", () => {
  it("is deterministic per seed and varies across seeds", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    const seqC = Array.from({ length: 8 }, () => c());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const v of seqA) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of seqA) expect(v).toBeLessThan(1);
  });
});

describe("buildEvents (seeded)", () => {
  it("same seed ⇒ byte-identical schedule (parallel chunk workers must agree)", () => {
    const t1 = makeTimeline(7);
    const t2 = makeTimeline(7);
    expect(t1.initial).toEqual(t2.initial);
    expect(t1.events).toEqual(t2.events);
  });

  it("different seeds ⇒ different schedules", () => {
    const t1 = makeTimeline(7);
    const t2 = makeTimeline(8);
    expect(t1.events).not.toEqual(t2.events);
  });

  it("a targeted sweep sends every recolored cell to the target token", () => {
    const { initial, events } = makeTimeline(7, false);
    const total = totalDuration(PULSES);
    void total;
    // The "sweep" pulse spans t in [1.5, 2.5) — all color events there must target "muted".
    const sweepColors = events.filter((e) => e.kind === "color" && e.t >= 1.5 && e.t < 2.5);
    expect(sweepColors.length).toBeGreaterThan(0);
    for (const e of sweepColors) expect(e.value).toBe("muted");
    void initial;
  });
});

describe("createCursor", () => {
  it("palindrome: with mirror on, the state at 2·total equals the opening state", () => {
    const { initial, events } = makeTimeline(11, true);
    const cursor = createCursor(initial, events);
    const end = cursor.stateAt(2 * totalDuration(PULSES) + 0.001);
    expect(end).toEqual(initial);
  });

  it("incremental stepping equals a fresh replay at every time", () => {
    const { initial, events } = makeTimeline(13);
    const stepped = createCursor(initial, events);
    const times = Array.from({ length: 60 }, (_, i) => i * 0.12);
    for (const t of times) {
      const fresh = createCursor(initial, events);
      expect(stepped.stateAt(t)).toEqual(fresh.stateAt(t));
    }
  });

  it("seeking backwards resets and replays correctly", () => {
    const { initial, events } = makeTimeline(17);
    const cursor = createCursor(initial, events);
    cursor.stateAt(3.5); // advance deep into the timeline
    const back = cursor.stateAt(1.0); // realtime restart
    const fresh = createCursor(initial, events).stateAt(1.0);
    expect(back).toEqual(fresh);
  });

  it("returns fresh arrays with replaced (not mutated) cells — safe for React state", () => {
    const { initial, events } = makeTimeline(19);
    const cursor = createCursor(initial, events);
    const a = cursor.stateAt(0);
    const b = cursor.stateAt(10);
    expect(b).not.toBe(a); // new array per call
    expect(initial.map((c: Cell) => c.text)).toEqual(createCursor(initial, []).stateAt(99).map((c) => c.text));
  });
});

describe("pulseNameAt", () => {
  it("names the active pulse and mirrors the reverse half", () => {
    const total = totalDuration(PULSES); // 3.5
    const clip = 2 * total;
    expect(pulseNameAt(PULSES, 0.1, true, clip)).toBe("hold");
    expect(pulseNameAt(PULSES, 1.0, true, clip)).toBe("letters");
    expect(pulseNameAt(PULSES, 2.0, true, clip)).toBe("sweep");
    // Reverse half: t = 2*total - 2.0 maps back onto "sweep".
    expect(pulseNameAt(PULSES, clip - 2.0, true, clip)).toBe("sweep");
    // The loop seam (t = clip) folds to t = 0 → "hold".
    expect(pulseNameAt(PULSES, clip, true, clip)).toBe("hold");
  });
});
