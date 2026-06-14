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

  it("is byte-identical when file dependencies are absent vs undefined (key stability)", () => {
    expect(computeCacheKey({ ...base, files: undefined })).toBe(computeCacheKey(base));
  });

  it("changes when a file dependency's content hash changes", () => {
    const withFont = computeCacheKey({ ...base, files: { "C:/fonts/x.woff2": "aaa" } });
    expect(withFont).not.toBe(computeCacheKey(base));
    expect(withFont).not.toBe(
      computeCacheKey({ ...base, files: { "C:/fonts/x.woff2": "bbb" } }),
    );
  });
});

describe("generator file dependencies", () => {
  it("specimen declares its font; scene declares its served files", async () => {
    const { specimenGenerator } = await import("@/generators/specimen");
    const { sceneGenerator } = await import("@/generators/scene");
    const specimenOpts = specimenGenerator.optionsSchema.parse({ font: "fonts/X.woff2" });
    expect(specimenGenerator.fileDependencies?.(specimenOpts)).toEqual(["fonts/X.woff2"]);
    const sceneOpts = sceneGenerator.optionsSchema.parse({
      files: { font: "a.woff2", logo: "b.png" },
    });
    expect(sceneGenerator.fileDependencies?.(sceneOpts)).toEqual(["a.woff2", "b.png"]);
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
