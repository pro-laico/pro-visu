import { describe, expect, it } from "vitest";
import { mergeGeneratorOptions } from "@/pipeline/runner";
import { scrollReelOptionsSchema } from "@/generators/scroll-reel/options";
import type { ResolvedAssetSpec } from "@/config/schema";

function spec(over: Partial<ResolvedAssetSpec> = {}): ResolvedAssetSpec {
  return {
    name: "a",
    url: "https://example.com",
    generator: "scroll-reel",
    options: {},
    inputs: {},
    ...over,
  };
}

describe("mergeGeneratorOptions", () => {
  it("applies defaults keyed by generator id", () => {
    const merged = mergeGeneratorOptions({ "scroll-reel": { width: 800 } }, spec());
    expect(scrollReelOptionsSchema.parse(merged).width).toBe(800);
  });

  it("ignores defaults under a non-matching key (camelCase regression)", () => {
    const merged = mergeGeneratorOptions({ scrollReel: { width: 800 } }, spec());
    // falls through to the schema default, NOT 800
    expect(scrollReelOptionsSchema.parse(merged).width).toBe(1280);
  });

  it("per-asset options win over generator defaults", () => {
    const merged = mergeGeneratorOptions(
      { "scroll-reel": { width: 800, fps: 24 } },
      spec({ options: { width: 1000 } }),
    );
    const opts = scrollReelOptionsSchema.parse(merged);
    expect(opts.width).toBe(1000);
    expect(opts.fps).toBe(24);
  });

  it("deep-merges nested objects — an asset overriding one field keeps the default's siblings", () => {
    const merged = mergeGeneratorOptions(
      { "scroll-reel": { kenBurns: { scaleTo: 1.08, originX: 0.3 } } },
      spec({ options: { kenBurns: { scaleTo: 1.02 } } }),
    );
    expect(merged.kenBurns).toEqual({ scaleTo: 1.02, originX: 0.3 });
  });

  it("replaces arrays wholesale (no element-wise merge)", () => {
    const merged = mergeGeneratorOptions(
      { "scroll-reel": { viewports: [{ name: "desktop", width: 1440, height: 900 }] } },
      spec({ options: { viewports: [{ name: "mobile", width: 390, height: 844 }] } }),
    );
    expect(merged.viewports).toEqual([{ name: "mobile", width: 390, height: 844 }]);
  });
});
