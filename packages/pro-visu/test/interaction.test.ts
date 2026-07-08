import { describe, expect, it } from "vitest";
import {
  clampCrop,
  interactionTotalMs,
  keystrokeGaps,
  writeDurationMs,
  DEFAULT_ACTION_DURATION_MS,
  DEFAULT_ACTION_HOLD_MS,
  DEFAULT_TYPE_DELAY_MS,
  DEFAULT_ERASE_DELAY_MS,
} from "@/generators/interaction/capture";
import { interactionOptionsSchema } from "@/generators/interaction/options";

describe("interactionTotalMs", () => {
  it("sums start delay + end dwell with no actions", () => {
    expect(interactionTotalMs([], 500, 800)).toBe(1300);
  });

  it("applies per-step defaults", () => {
    const total = interactionTotalMs([{}, {}], 0, 0);
    expect(total).toBe(2 * (DEFAULT_ACTION_DURATION_MS + DEFAULT_ACTION_HOLD_MS));
  });

  it("honors explicit step timings", () => {
    const total = interactionTotalMs(
      [
        { durationMs: 1000, holdMs: 500 },
        { durationMs: 200, holdMs: 0 },
      ],
      100,
      100,
    );
    // 100 + 100 + (1000 + 500) + (200 + 0) = 1900
    expect(total).toBe(1900);
  });

  it("adds keystroke time for type/erase steps", () => {
    // type "abcd" at 50ms/key = 200ms of keystrokes on top of travel + hold.
    const total = interactionTotalMs(
      [{ do: "type", text: "abcd", delayMs: 50, durationMs: 100, holdMs: 0 }],
      0,
      0,
    );
    expect(total).toBe(100 + 200 + 0);
  });
});

describe("keystrokeGaps", () => {
  it("linear yields even gaps that sum to delayMs * count", () => {
    const gaps = keystrokeGaps(4, 100, "linear");
    expect(gaps).toEqual([100, 100, 100, 100]);
    expect(gaps.reduce((a, b) => a + b, 0)).toBe(400);
  });

  it("preserves the total run time under any easing", () => {
    for (const e of ["ease-in", "ease-out", "ease-in-out"] as const) {
      const sum = keystrokeGaps(6, 80, e).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(480, 6);
    }
  });

  it("ease-in starts quick and trails off (gaps grow)", () => {
    const gaps = keystrokeGaps(4, 100, "ease-in");
    const first = gaps[0] ?? 0;
    const last = gaps[gaps.length - 1] ?? 0;
    expect(first).toBeLessThan(last);
  });

  it("ease-out starts measured and quickens (gaps shrink)", () => {
    const gaps = keystrokeGaps(4, 100, "ease-out");
    const first = gaps[0] ?? 0;
    const last = gaps[gaps.length - 1] ?? 0;
    expect(first).toBeGreaterThan(last);
  });

  it("returns all-zero gaps for instant (delayMs 0) and empty for no keystrokes", () => {
    expect(keystrokeGaps(3, 0, "linear")).toEqual([0, 0, 0]);
    expect(keystrokeGaps(0, 100, "linear")).toEqual([]);
  });
});

describe("writeDurationMs", () => {
  it("type counts text length × per-key delay (default when omitted)", () => {
    expect(writeDurationMs({ do: "type", text: "hello", delayMs: 40 })).toBe(200);
    expect(writeDurationMs({ do: "type", text: "hi" })).toBe(2 * DEFAULT_TYPE_DELAY_MS);
  });

  it("erase counts explicit count × per-key delay; erase-all is 0 (length unknown statically)", () => {
    expect(writeDurationMs({ do: "erase", count: 6, delayMs: 50 })).toBe(300);
    expect(writeDurationMs({ do: "erase", count: 3 })).toBe(3 * DEFAULT_ERASE_DELAY_MS);
    expect(writeDurationMs({ do: "erase" })).toBe(0);
  });

  it("is 0 for non-write steps", () => {
    expect(writeDurationMs({ do: "click" })).toBe(0);
  });
});

describe("interactionOptionsSchema setup/teardown", () => {
  it("defaults setup and teardown to empty arrays", () => {
    const o = interactionOptionsSchema.parse({ actions: [{ do: "wait" }] });
    expect(o.setup).toEqual([]);
    expect(o.teardown).toEqual([]);
  });

  it("parses setup/teardown steps using the same Action shape as actions", () => {
    const o = interactionOptionsSchema.parse({
      setup: [{ do: "move", selector: "#menu-button", durationMs: 0, holdMs: 0 }],
      actions: [{ do: "click", selector: "#menu-button" }],
      teardown: [{ do: "click", selector: "#menu-button" }],
    });
    expect(o.setup[0]).toMatchObject({ do: "move", selector: "#menu-button", durationMs: 0 });
    expect(o.teardown[0]).toMatchObject({ do: "click", selector: "#menu-button" });
  });

  it("keeps setup/teardown out of the kept-window duration (that's actions + delays only)", () => {
    // setup/teardown run off-camera, so they must not feed interactionTotalMs.
    expect(interactionTotalMs([], 500, 800)).toBe(1300);
  });
});

describe("interactionOptionsSchema write actions", () => {
  it("parses type/erase/press steps with their fields", () => {
    const o = interactionOptionsSchema.parse({
      actions: [
        { do: "type", selector: "#q", text: "silk", delayMs: 60, easing: "ease-out" },
        { do: "erase", selector: "#q", count: 4, delayMs: 80, easing: "ease-in" },
        { do: "press", key: "Enter" },
        { do: "press", key: "f", modifiers: ["Control"] },
      ],
    });
    expect(o.actions[0]).toMatchObject({ do: "type", text: "silk", delayMs: 60, easing: "ease-out" });
    expect(o.actions[1]).toMatchObject({ do: "erase", count: 4 });
    expect(o.actions[3]).toMatchObject({ do: "press", key: "f", modifiers: ["Control"] });
  });

  it("rejects an unknown modifier", () => {
    expect(() =>
      interactionOptionsSchema.parse({ actions: [{ do: "press", key: "f", modifiers: ["Ctrl"] }] }),
    ).toThrow();
  });
});

describe("clampCrop", () => {
  it("adds padding and rounds to even dimensions", () => {
    expect(clampCrop({ x: 100, y: 100, w: 201, h: 99 }, 10, 1280, 720)).toEqual({
      x: 90,
      y: 90,
      width: 220, // ceil(221) → even 220
      height: 118, // ceil(119) → even 118
    });
  });

  it("clamps a box overflowing the right/bottom edges", () => {
    const c = clampCrop({ x: 1200, y: 700, w: 200, h: 200 }, 0, 1280, 720);
    expect(c).toEqual({ x: 1200, y: 700, width: 80, height: 20 });
  });

  it("clamps a negative origin produced by padding", () => {
    const c = clampCrop({ x: 5, y: 5, w: 100, h: 100 }, 20, 1280, 720);
    expect(c.x).toBe(0);
    expect(c.y).toBe(0);
    expect(c.width).toBe(124);
    expect(c.height).toBe(124);
  });
});
