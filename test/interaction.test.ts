import { describe, expect, it } from "vitest";
import {
  clampCrop,
  interactionTotalMs,
  DEFAULT_ACTION_DURATION_MS,
  DEFAULT_ACTION_HOLD_MS,
} from "@/generators/scroll-reel/interaction";

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
