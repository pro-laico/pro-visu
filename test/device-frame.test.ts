import { describe, expect, it } from "vitest";
import { deviceFrameOptionsSchema } from "@/generators/device-frame/options";
import { buildDeviceFrameArgs } from "@/generators/device-frame/composite";
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

describe("buildDeviceFrameArgs", () => {
  const base = {
    videoPath: "in.mp4",
    framePng: "chrome.png",
    maskPng: "mask.png",
    outPath: "out.mp4",
    frameWidth: 1476,
    frameHeight: 1048,
    viewport: { x: 98, y: 150, w: 1280, h: 800 },
    background: "#0b0b0f",
    fps: 30,
    crf: 18,
    durationSeconds: 7.3,
  };

  it("orders the three inputs: video, chrome, mask", () => {
    const argv = buildDeviceFrameArgs(base);
    const inputs = argv.reduce<string[]>((acc, a, i) => {
      const next = argv[i + 1];
      if (a === "-i" && next) acc.push(next);
      return acc;
    }, []);
    expect(inputs).toEqual(["in.mp4", "chrome.png", "mask.png"]);
  });

  it("composites backdrop, chrome, then corner-masked video at the viewport offset", () => {
    const argv = buildDeviceFrameArgs(base);
    const filter = argv[argv.indexOf("-filter_complex") + 1] ?? "";
    expect(filter).toContain("color=c=#0b0b0f:s=1476x1048");
    expect(filter).toContain("alphaextract"); // rounds the video corners
    expect(filter).toContain("[bg][1:v]overlay=0:0"); // chrome over backdrop
    expect(filter).toContain("overlay=98:150"); // video into the viewport
  });

  it("encodes a web-friendly h264 mp4", () => {
    const argv = buildDeviceFrameArgs(base);
    expect(argv).toContain("libx264");
    expect(argv[argv.indexOf("-crf") + 1]).toBe("18");
    expect(argv).toContain("yuv420p");
    expect(argv[argv.length - 1]).toBe("out.mp4");
  });
});
