import { describe, expect, it, vi } from "vitest";
import type { Browser } from "playwright-core";
import { autoWorkers, captureFramedVideo, planFrames } from "@/media/frame-capture";
import { createLogger } from "@/utils/logger";

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

describe("captureFramedVideo cancellation", () => {
  it("aborts before creating any context when cancelled up front", async () => {
    const seekToFrame = vi.fn(async () => {});
    const page = {
      on: () => {},
      screenshot: async () => Buffer.alloc(0),
    };
    const context = { newPage: async () => page, close: async () => {} };
    const newContext = vi.fn(async () => context);
    const browser = { newContext } as unknown as Browser;

    const controller = new AbortController();
    controller.abort(); // already cancelled before any frame work

    await expect(
      captureFramedVideo({
        browser,
        width: 100,
        height: 100,
        deviceScaleFactor: 1,
        fps: 10,
        durationSeconds: 1,
        crf: 30,
        outPath: "out.mp4",
        tmpDir: ".",
        logger: createLogger("silent"),
        signal: controller.signal,
        prepare: async () => ({}),
        seekToFrame,
      }),
    ).rejects.toThrow();

    expect(newContext).not.toHaveBeenCalled(); // pre-aborted → no context is ever spawned
    expect(seekToFrame).not.toHaveBeenCalled(); // never reached the frame loop / encoder
  });

  it("aborts after prepare without spawning the encoder, still closing the context", async () => {
    const seekToFrame = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const page = {
      on: () => {},
      screenshot: async () => Buffer.alloc(0),
    };
    const context = { newPage: async () => page, close };
    const browser = { newContext: async () => context } as unknown as Browser;

    const controller = new AbortController();

    await expect(
      captureFramedVideo({
        browser,
        width: 100,
        height: 100,
        deviceScaleFactor: 1,
        fps: 10,
        durationSeconds: 1,
        crf: 30,
        outPath: "out.mp4",
        tmpDir: ".",
        logger: createLogger("silent"),
        signal: controller.signal,
        prepare: async () => {
          controller.abort(); // cancelled while the page was being prepared
          return {};
        },
        seekToFrame,
      }),
    ).rejects.toThrow();

    expect(seekToFrame).not.toHaveBeenCalled(); // never reached the frame loop / encoder
    expect(close).toHaveBeenCalled(); // browser context still cleaned up
  });
});
