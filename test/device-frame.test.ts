import { describe, expect, it } from "vitest";
import { deviceFrameOptionsSchema } from "@/generators/device-frame/options";
import { generatorIds, getGenerator } from "@/generators/registry";
import { DEVICE_FRAME_ID } from "@/generators/device-frame";
import { mergeGeneratorOptions } from "@/pipeline/runner";

describe("device-frame generator", () => {
  it("is registered", () => {
    expect(generatorIds()).toContain(DEVICE_FRAME_ID);
    expect(getGenerator(DEVICE_FRAME_ID)?.id).toBe(DEVICE_FRAME_ID);
  });

  it("inherits scroll-reel capture defaults and adds frame controls", () => {
    const opts = deviceFrameOptionsSchema.parse({});
    expect(opts.width).toBe(1280); // inherited capture default
    expect(opts.duration).toBe(6000); // inherited
    expect(opts.background).toBe("#0b0b0f");
    expect(opts.frameWidth).toBe(1280);
  });

  it("rejects unknown option keys (typo guard)", () => {
    expect(deviceFrameOptionsSchema.safeParse({ framewidth: 10 }).success).toBe(false);
  });

  it("merges defaults keyed by generator id", () => {
    const merged = mergeGeneratorOptions(
      { "device-frame": { background: "#ffffff", frameWidth: 1000 } },
      { name: "a", url: "https://example.com", generator: "device-frame", options: {} },
    );
    const opts = deviceFrameOptionsSchema.parse(merged);
    expect(opts.background).toBe("#ffffff");
    expect(opts.frameWidth).toBe(1000);
  });
});
