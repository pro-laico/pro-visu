import { describe, expect, it } from "vitest";
import {
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
