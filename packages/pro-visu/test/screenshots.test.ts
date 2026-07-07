import { describe, expect, it, vi } from "vitest";
import type { Browser } from "playwright-core";
import { screenshotsOptionsSchema } from "@/generators/screenshots/options";
import { captureScreenshots } from "@/generators/screenshots/capture";
import { captureSettingsSchema } from "@/config/schema";
import { getGenerator, generatorIds } from "@/generators/registry";
import { SCREENSHOTS_ID } from "@/generators/screenshots";
import { mergeGeneratorOptions } from "@/pipeline/runner";
import { createLogger } from "@/utils/logger";

describe("screenshots generator", () => {
  it("is registered", () => {
    expect(generatorIds()).toContain(SCREENSHOTS_ID);
    expect(getGenerator(SCREENSHOTS_ID)?.id).toBe(SCREENSHOTS_ID);
  });

  it("applies sensible defaults", () => {
    const opts = screenshotsOptionsSchema.parse({});
    expect(opts.viewports.map((b) => b.name)).toEqual(["desktop", "mobile"]);
    expect(opts.viewports[0]!.height).toBe(900); // default desktop viewport
    expect(opts.fullPage).toBe(true);
    expect(opts.output.format).toBe("png");
    expect(opts.output.deviceScaleFactor).toBe(2);
    expect(opts.elements).toEqual([]);
  });

  it("rejects unknown option keys (typo guard)", () => {
    expect(screenshotsOptionsSchema.safeParse({ fullpage: true }).success).toBe(false);
  });

  it("rejects `quality` on a png (it would be silently ignored otherwise)", () => {
    const png = screenshotsOptionsSchema.safeParse({ output: { format: "png", quality: 80 } });
    expect(png.success).toBe(false);
    expect(png.error?.issues[0]?.path).toEqual(["output", "quality"]);
    expect(
      screenshotsOptionsSchema.safeParse({ output: { format: "jpeg", quality: 80 } }).success,
    ).toBe(true);
  });

  it("merges defaults keyed by generator id", () => {
    const merged = mergeGeneratorOptions(
      { screenshots: { output: { format: "jpeg", quality: 80 } } },
      { name: "a", url: "https://example.com", generator: "screenshots", options: {}, inputs: {} },
    );
    const opts = screenshotsOptionsSchema.parse(merged);
    expect(opts.output.format).toBe("jpeg");
    expect(opts.output.quality).toBe(80);
  });

  it("persists each shot as it is captured (buffers are not held until the end)", async () => {
    const options = screenshotsOptionsSchema.parse({
      viewports: [
        { name: "desktop", width: 1440, height: 900 },
        { name: "mobile", width: 390, height: 844 },
      ],
    });
    let inFlightAtPersist = -1;
    let shotsTaken = 0;
    const page = {
      goto: async () => {},
      evaluate: async () => {},
      screenshot: async () => {
        shotsTaken += 1;
        return Buffer.from(`shot-${shotsTaken}`);
      },
    };
    const context = { newPage: async () => page, close: vi.fn(async () => {}) };
    const browser = { newContext: async () => context } as unknown as Browser;

    const persisted: string[] = [];
    const records = await captureScreenshots({
      browser,
      url: "https://example.com",
      options,
      // Tracker blocking / suppression CSS would need page.route / addStyleTag on the stub page.
      capture: captureSettingsSchema.parse({ blockTrackers: false, hideScrollbars: false }),
      logger: createLogger("silent"),
      persist: async (key, buffer) => {
        // Persist runs while capture is still in flight, not after everything is collected.
        inFlightAtPersist = Math.max(inFlightAtPersist, shotsTaken);
        persisted.push(key);
        return { key, bytes: buffer.length };
      },
    });

    expect(records).toHaveLength(2); // one page shot per viewport
    expect(records.map((r) => r.key)).toEqual(["desktop", "mobile"]); // viewport order preserved
    expect(persisted).toHaveLength(2);
    expect(inFlightAtPersist).toBeGreaterThan(0); // persist was interleaved with capturing
    expect(context.close).toHaveBeenCalledTimes(2); // one isolated context per viewport, closed
  });
});
