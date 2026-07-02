import { describe, expect, it } from "vitest";
import { loopTime, trackOffset, trackTravel, type Track } from "../scene-app/src/scenes/wall-motion";

const D = 16; // clip seconds
const period = 800; // px per tile-set

describe("trackTravel (pulse-sum motion, in periods)", () => {
  it("starts at 0 and ends on a whole number of periods (seamless)", () => {
    const pulses = [{ at: 0.2, span: 0.15, distance: 0.5 }];
    expect(trackTravel(pulses, 1, 0, D)).toBeCloseTo(0, 6);
    // loops 1 + pulse 0.5 = 1.5 → rounds UP to 2 whole periods at the clip end
    expect(trackTravel(pulses, 1, D, D)).toBeCloseTo(2, 6);
  });

  it("folds the fractional remainder into the continuous scroll", () => {
    expect(trackTravel([], 1, D, D)).toBeCloseTo(1, 6); // loops 1, no pulses → 1
    expect(trackTravel([], 0, D, D)).toBeCloseTo(0, 6); // loops 0, no pulses → frozen
    // loops 0 + one full-clip pulse of one period → 1 (pure pulse, no forced creep)
    expect(trackTravel([{ at: 0, span: 1, distance: 1 }], 0, D, D)).toBeCloseTo(1, 6);
    // loops 2 + pulses summing 0.5 → ceil(2.5) = 3
    expect(trackTravel([{ at: 0.3, span: 0.15, distance: 0.5 }], 2, D, D)).toBeCloseTo(3, 6);
  });

  it("a pulse advances travel monotonically across its window", () => {
    const pulses = [{ at: 0.25, span: 0.25, distance: 1 }]; // window u ∈ [0.25, 0.5]
    const start = trackTravel(pulses, 0, D * 0.25, D);
    const mid = trackTravel(pulses, 0, D * 0.375, D);
    const done = trackTravel(pulses, 0, D * 0.5, D);
    expect(start).toBeCloseTo(0, 6);
    expect(mid).toBeGreaterThan(start);
    expect(done).toBeGreaterThan(mid);
    expect(done).toBeCloseTo(1, 6); // distance 1, loops 0 → exactly one period once the pulse completes
  });

  it("shifts a late pulse back so it ends at the loop point (never overruns)", () => {
    // at 0.9 + duration 0.2 = 1.1 > 1 → start shifts back to 0.8 (1 − duration)
    const pulses = [{ at: 0.9, span: 0.2, distance: 1 }];
    expect(trackTravel(pulses, 0, D * 0.79, D)).toBeCloseTo(0, 6); // hasn't started before u=0.8
    expect(trackTravel(pulses, 0, D * 0.9, D)).toBeGreaterThan(0); // mid-pulse
    expect(trackTravel(pulses, 0, D, D)).toBeCloseTo(1, 6); // completes exactly at the clip end
  });
});

describe("trackOffset (seam: offset(D) ≡ offset(0))", () => {
  const tracks: Track[] = [
    { pulses: [], loops: 1, dir: 1 },
    { pulses: [{ at: 0.1, span: 0.15, distance: 0.5 }], loops: 1, dir: -1 },
    {
      pulses: [
        { at: 0.3, span: 0.2, distance: 0.25 },
        { at: 0.7, span: 0.2, distance: 0.75 },
      ],
      loops: 2,
      dir: 1,
    },
    { pulses: [{ at: 0, span: 1, distance: 1, easing: "linear" }], loops: 0, dir: -1 },
  ];

  it("returns to its t=0 offset at t=D for varied loops / pulses / direction", () => {
    for (const tr of tracks) {
      expect(trackOffset(tr, 0, period, D)).toBeCloseTo(0, 6);
      expect(trackOffset(tr, D, period, D)).toBeCloseTo(0, 6);
    }
  });

  it("is seamless for any clip length (10s or 20s, same config)", () => {
    const tr = tracks[1] as Track;
    for (const len of [10, 20, 37]) {
      expect(trackOffset(tr, len, period, len)).toBeCloseTo(0, 6);
    }
  });

  it("is frozen at 0 when there is no motion (loops 0, no pulses)", () => {
    expect(trackOffset({ pulses: [], loops: 0, dir: 1 }, D / 2, period, D)).toBe(0);
  });

  it("actually moves during the clip when it has motion", () => {
    const tr = tracks[2] as Track;
    const samples = [0.2, 0.5, 0.8].map((f) => trackOffset(tr, D * f, period, D).toFixed(1));
    expect(new Set(samples).size).toBeGreaterThan(1);
  });

  it("direction flips the sign of travel (up = mirror of down)", () => {
    const pulses = [{ at: 0.2, span: 0.2, distance: 0.5 }];
    const down = trackOffset({ pulses, loops: 1, dir: 1 }, D * 0.5, period, D);
    const up = trackOffset({ pulses, loops: 1, dir: -1 }, D * 0.5, period, D);
    expect((down + up) % period).toBeCloseTo(0, 4); // mod-mirror around the period
  });

  it("stagger shifts the start position by a fraction of a period, preserving the seam", () => {
    const base: Track = { pulses: [{ at: 0.1, span: 0.15, distance: 0.5 }], loops: 1, dir: 1 };
    const staggered: Track = { ...base, stagger: 0.25 };
    // t=0 starts shifted by 0.25 of a period (instead of 0)
    expect(trackOffset(base, 0, period, D)).toBeCloseTo(0, 6);
    expect(trackOffset(staggered, 0, period, D)).toBeCloseTo(0.25 * period, 6);
    // still seamless: offset(D) ≡ offset(0)
    expect(trackOffset(staggered, D, period, D)).toBeCloseTo(trackOffset(staggered, 0, period, D), 6);
    // a constant phase shift at every moment (mod period)
    const mod = (n: number): number => ((n % period) + period) % period;
    for (const f of [0, 0.3, 0.6, 0.9]) {
      const delta = mod(trackOffset(staggered, D * f, period, D) - trackOffset(base, D * f, period, D));
      expect(delta).toBeCloseTo(0.25 * period, 4);
    }
  });
});

describe("loopTime", () => {
  it("passes through within duration and wraps beyond it", () => {
    expect(loopTime(3, 5)).toBe(3);
    expect(loopTime(7, 5)).toBeCloseTo(2, 6);
    expect(loopTime(12, 5)).toBeCloseTo(2, 6);
  });

  it("returns t unchanged for non-finite/zero duration", () => {
    expect(loopTime(4, 0)).toBe(4);
    expect(loopTime(4, NaN)).toBe(4);
    expect(loopTime(4, Infinity)).toBe(4);
  });
});
