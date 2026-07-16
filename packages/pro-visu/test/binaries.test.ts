import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { downloadFfmpeg, ffmpegBinaryPath, ffmpegIsSupported } from "@/binaries/ffmpeg-binary";

function withPlatform(platform: NodeJS.Platform, fn: () => void | Promise<void>): void | Promise<void> {
  const original = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", { value: platform });
  const restore = (): void => {
    Object.defineProperty(process, "platform", original);
  };
  try {
    const out = fn();
    if (out instanceof Promise) return out.finally(restore);
    restore();
  } catch (err) {
    restore();
    throw err;
  }
}

describe("ffmpeg binary provisioning", () => {
  let binBefore: string | undefined;

  beforeEach(() => {
    binBefore = process.env.FFMPEG_BIN;
    delete process.env.FFMPEG_BIN;
  });

  afterEach(() => {
    if (binBefore === undefined) delete process.env.FFMPEG_BIN;
    else process.env.FFMPEG_BIN = binBefore;
  });

  it("supports the platforms the pinned release actually ships", () => {
    expect(withPlatform("win32", () => expect(ffmpegIsSupported()).toBe(true)));
    expect(withPlatform("darwin", () => expect(ffmpegIsSupported()).toBe(true)));
    expect(withPlatform("linux", () => expect(ffmpegIsSupported()).toBe(true)));
    expect(withPlatform("freebsd", () => expect(ffmpegIsSupported()).toBe(false)));
    expect(withPlatform("aix", () => expect(ffmpegIsSupported()).toBe(false)));
  });

  it("FFMPEG_BIN overrides the managed cache path", () => {
    process.env.FFMPEG_BIN = path.join("C:", "tools", "ffmpeg.exe");
    expect(ffmpegBinaryPath()).toBe(process.env.FFMPEG_BIN);
  });

  it("defaults to the versioned shared-cache binary", () => {
    const p = ffmpegBinaryPath();
    expect(p).toContain(path.join("pro-visu", "ffmpeg"));
    expect(path.basename(p)).toBe(process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  });

  it("refuses to download for an unsupported platform with an actionable error", async () => {
    await withPlatform("aix", async () => {
      await expect(downloadFfmpeg()).rejects.toThrow(/No prebuilt ffmpeg .* Set FFMPEG_BIN/);
    });
  });
});
