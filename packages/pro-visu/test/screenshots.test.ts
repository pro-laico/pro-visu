import { describe, expect, it } from "vitest";
import { screenshotsOptionsSchema } from "@/generators/screenshots/options";
import { getGenerator, generatorIds } from "@/generators/registry";
import { SCREENSHOTS_ID } from "@/generators/screenshots";
import { mergeGeneratorOptions } from "@/pipeline/runner";

describe("screenshots generator", () => {
  it("is registered", () => {
    expect(generatorIds()).toContain(SCREENSHOTS_ID);
    expect(getGenerator(SCREENSHOTS_ID)?.id).toBe(SCREENSHOTS_ID);
  });

  it("applies sensible defaults", () => {
    const opts = screenshotsOptionsSchema.parse({});
    expect(opts.breakpoints.map((b) => b.name)).toEqual(["desktop", "mobile"]);
    expect(opts.breakpoints[0]!.height).toBe(900); // breakpoint default fills in
    expect(opts.fullPage).toBe(true);
    expect(opts.format).toBe("png");
    expect(opts.deviceScaleFactor).toBe(2);
    expect(opts.elements).toEqual([]);
  });

  it("rejects unknown option keys (typo guard)", () => {
    expect(screenshotsOptionsSchema.safeParse({ fullpage: true }).success).toBe(false);
  });

  it("rejects `quality` on a png (it would be silently ignored otherwise)", () => {
    expect(screenshotsOptionsSchema.safeParse({ format: "png", quality: 80 }).success).toBe(false);
    expect(screenshotsOptionsSchema.safeParse({ format: "jpeg", quality: 80 }).success).toBe(true);
  });

  it("merges defaults keyed by generator id", () => {
    const merged = mergeGeneratorOptions(
      { screenshots: { format: "jpeg", quality: 80 } },
      { name: "a", url: "https://example.com", generator: "screenshots", options: {}, inputs: {} },
    );
    const opts = screenshotsOptionsSchema.parse(merged);
    expect(opts.format).toBe("jpeg");
    expect(opts.quality).toBe(80);
  });
});
