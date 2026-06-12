import { describe, expect, it } from "vitest";
import { computeCacheKey } from "@/pipeline/cache";
import { applyQuality } from "@/pipeline/runner";

describe("computeCacheKey", () => {
  const base = {
    generator: "scene",
    url: undefined,
    options: { a: 1, b: 2 },
    inputs: { screen: "hash1" },
    quality: "final",
    toolVersion: "0.1.0",
  };

  it("is stable regardless of option key order", () => {
    expect(computeCacheKey({ ...base, options: { a: 1, b: 2 } })).toBe(
      computeCacheKey({ ...base, options: { b: 2, a: 1 } }),
    );
  });

  it("changes when an input's content hash changes", () => {
    expect(computeCacheKey(base)).not.toBe(
      computeCacheKey({ ...base, inputs: { screen: "hash2" } }),
    );
  });

  it("changes with quality and toolVersion", () => {
    expect(computeCacheKey(base)).not.toBe(computeCacheKey({ ...base, quality: "draft" }));
    expect(computeCacheKey(base)).not.toBe(
      computeCacheKey({ ...base, toolVersion: "0.2.0" }),
    );
  });
});

describe("applyQuality", () => {
  it("passes options through unchanged in final", () => {
    expect(applyQuality({ fps: 30, deviceScaleFactor: 2, crf: 18 }, "final")).toEqual({
      fps: 30,
      deviceScaleFactor: 2,
      crf: 18,
    });
  });

  it("lowers fps + scale and loosens crf in draft", () => {
    const o = applyQuality({ fps: 30, deviceScaleFactor: 2, crf: 18 }, "draft");
    expect(o.fps).toBe(15);
    expect(o.deviceScaleFactor).toBe(1);
    expect(o.crf).toBe(30);
  });

  it("never raises crf above what was set", () => {
    expect(applyQuality({ crf: 40 }, "draft").crf).toBe(40);
  });
});
