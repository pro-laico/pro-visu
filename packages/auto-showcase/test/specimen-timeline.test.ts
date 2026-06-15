import { describe, expect, it } from "vitest";
import {
  buildEvents,
  buildSpec,
  packAndSeedLines,
  createCursor,
  maxLineDrift,
  mulberry32,
  pulseNameAt,
  totalDuration,
  DEFAULT_WEIGHTS,
  type Cell,
  type Pulse,
} from "../scene-app/src/scenes/specimen-timeline";

/** Fabricated per-glyph advances (no DOM): a deterministic spread so packing/budget have variety. */
function fakeAdvances(pool: string): Record<string, number> {
  const adv: Record<string, number> = {};
  [...pool].forEach((c, i) => (adv[c] = 0.42 + ((i * 5) % 11) * 0.04));
  return adv;
}

const TARGET_EM = 6;
const LINES = 3;
const TOL = 0.05;

// `chars`/`colors` are fractions of the wall. The "sweep" beat recolors every cell to "muted".
const PULSES: Pulse[] = [
  { name: "hold", duration: 0.5 },
  { name: "letters", duration: 1, chars: 0.5, pacing: "ease-in-out" },
  { name: "sweep", duration: 1, colors: 1, color: "muted", pacing: "even" },
  { name: "scatter", duration: 1, chars: 0.3, colors: 0.3, pacing: "random" },
];

/** Build a full deterministic timeline (pool → pack → events) from a seed. */
function makeTimeline(seed: number, mirror = true) {
  const spec = buildSpec("");
  const adv = fakeAdvances(spec.pool);
  const rng = mulberry32(seed); // one stream feeds packing then the schedule, as in the scene
  const packed = packAndSeedLines({ lines: LINES, targetEm: TARGET_EM, adv, pool: spec.pool, rng, minPerLine: 3 });
  const events = buildEvents(
    PULSES,
    mirror,
    packed.cells,
    adv,
    spec.pool,
    packed.lineLengths,
    packed.lineInitialEm,
    1,
    1,
    DEFAULT_WEIGHTS,
    TOL,
    rng,
  );
  return { initial: packed.cells, events, packed, adv };
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

describe("packAndSeedLines", () => {
  it("packs `lines` lines, each filled tight to just under the target width", () => {
    const spec = buildSpec("");
    const adv = fakeAdvances(spec.pool);
    const maxAdv = Math.max(...Object.values(adv));
    const packed = packAndSeedLines({ lines: 4, targetEm: TARGET_EM, adv, pool: spec.pool, rng: mulberry32(3), minPerLine: 3 });
    expect(packed.lineLengths.length).toBe(4);
    expect(packed.cells.length).toBe(packed.lineLengths.reduce((a, b) => a + b, 0));
    for (let L = 0; L < 4; L++) {
      expect(packed.lineLengths[L]).toBeGreaterThanOrEqual(3); // minPerLine
      expect(packed.lineInitialEm[L]).toBeLessThanOrEqual(TARGET_EM + 1e-9); // ≤ target
      expect(packed.lineInitialEm[L]).toBeGreaterThan(TARGET_EM - maxAdv - 1e-9); // within one glyph of full
    }
  });

  it("is pure — same rng seed ⇒ identical layout", () => {
    const spec = buildSpec("");
    const adv = fakeAdvances(spec.pool);
    const a = packAndSeedLines({ lines: 3, targetEm: TARGET_EM, adv, pool: spec.pool, rng: mulberry32(5), minPerLine: 3 });
    const b = packAndSeedLines({ lines: 3, targetEm: TARGET_EM, adv, pool: spec.pool, rng: mulberry32(5), minPerLine: 3 });
    expect(a).toEqual(b);
  });

  it("a single-width pool yields equal line lengths", () => {
    const pool = "ABCD";
    const adv = { A: 0.6, B: 0.6, C: 0.6, D: 0.6 };
    const packed = packAndSeedLines({ lines: 4, targetEm: TARGET_EM, adv, pool, rng: mulberry32(2), minPerLine: 3 });
    expect(new Set(packed.lineLengths).size).toBe(1); // every line the same length
  });

  it("forces at least minPerLine glyphs even when the font is huge", () => {
    const spec = buildSpec("");
    const adv = fakeAdvances(spec.pool);
    const packed = packAndSeedLines({ lines: 2, targetEm: 0.1, adv, pool: spec.pool, rng: mulberry32(1), minPerLine: 4 });
    for (const len of packed.lineLengths) expect(len).toBeGreaterThanOrEqual(4);
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
    const { events } = makeTimeline(7, false);
    // The "sweep" pulse spans t in [1.5, 2.5) — all color events there must target "muted".
    const sweepColors = events.filter((e) => e.kind === "color" && e.t >= 1.5 && e.t < 2.5);
    expect(sweepColors.length).toBeGreaterThan(0);
    for (const e of sweepColors) expect(e.value).toBe("muted");
  });

  it("keeps every line's width within the drift budget at all times (the guarantee)", () => {
    const { initial, events, packed, adv } = makeTimeline(7, true);
    // Char events should actually happen (the budget is being exercised, not trivially empty).
    expect(events.some((e) => e.kind === "char")).toBe(true);
    expect(maxLineDrift(initial, events, adv, packed.lineLengths)).toBeLessThanOrEqual(TOL + 1e-9);
  });
});

describe("fractional pulse counts", () => {
  it("colors:1 even sweep touches every cell once; colors:0.5 touches half", () => {
    const spec = buildSpec("");
    const adv = fakeAdvances(spec.pool);
    const packed = packAndSeedLines({ lines: 3, targetEm: TARGET_EM, adv, pool: spec.pool, rng: mulberry32(9), minPerLine: 3 });
    const N = packed.cells.length;
    const colorEvents = (frac: number) =>
      buildEvents(
        [{ name: "s", duration: 1, colors: frac, color: "muted", pacing: "even" }],
        false,
        packed.cells,
        adv,
        spec.pool,
        packed.lineLengths,
        packed.lineInitialEm,
        1,
        1,
        DEFAULT_WEIGHTS,
        TOL,
        mulberry32(9),
      ).filter((e) => e.kind === "color");

    const full = colorEvents(1);
    expect(full.length).toBe(N);
    expect(new Set(full.map((e) => e.slot)).size).toBe(N); // every distinct cell once
    for (const e of full) expect(e.value).toBe("muted");

    expect(colorEvents(0.5).length).toBe(Math.round(0.5 * N));
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
    expect(initial.map((c: Cell) => c.text)).toEqual(
      createCursor(initial, []).stateAt(99).map((c) => c.text),
    );
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
