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
    const merged = mergeGeneratorOptions({ "scroll-reel": { output: { width: 800 } } }, spec());
    expect(scrollReelOptionsSchema.parse(merged).output.width).toBe(800);
  });

  it("ignores defaults under a non-matching key (camelCase regression)", () => {
    const merged = mergeGeneratorOptions({ scrollReel: { output: { width: 800 } } }, spec());
    // falls through to the schema default, NOT 800
    expect(scrollReelOptionsSchema.parse(merged).output.width).toBe(1280);
  });

  it("per-asset options win over generator defaults", () => {
    const merged = mergeGeneratorOptions(
      { "scroll-reel": { output: { width: 800, fps: 24 } } },
      spec({ options: { output: { width: 1000 } } }),
    );
    const opts = scrollReelOptionsSchema.parse(merged);
    expect(opts.output.width).toBe(1000);
    expect(opts.output.fps).toBe(24);
  });

  it("deep-merges nested objects — an asset overriding one field keeps the default's siblings", () => {
    const merged = mergeGeneratorOptions(
      { "scroll-reel": { output: { width: 800, height: 900 } } },
      spec({ options: { output: { width: 1000 } } }),
    );
    expect(merged.output).toEqual({ width: 1000, height: 900 });
  });

  it("replaces arrays wholesale (no element-wise merge)", () => {
    const merged = mergeGeneratorOptions(
      { "scroll-reel": { variants: { viewports: [{ name: "desktop", width: 1440, height: 900 }] } } },
      spec({ options: { variants: { viewports: [{ name: "mobile", width: 390, height: 844 }] } } }),
    );
    expect((merged.variants as { viewports: unknown }).viewports).toEqual([
      { name: "mobile", width: 390, height: 844 },
    ]);
  });
});
