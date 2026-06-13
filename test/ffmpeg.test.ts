import { describe, expect, it } from "vitest";
import { buildTranscodeArgs, buildFramePipeArgs, buildConcatArgs } from "@/media/ffmpeg";

describe("buildTranscodeArgs", () => {
  const args = buildTranscodeArgs({
    inputPath: "in.webm",
    outputPath: "out.mp4",
    fps: 30,
    width: 1280,
    height: 720,
    crf: 18,
  });

  it("reads the input and writes the output last", () => {
    expect(args[args.indexOf("-i") + 1]).toBe("in.webm");
    expect(args[args.length - 1]).toBe("out.mp4");
  });

  it("encodes web-friendly h264", () => {
    expect(args).toContain("libx264");
    expect(args).toContain("yuv420p");
    expect(args).toContain("+faststart");
    expect(args).toContain("-an");
  });

  it("applies scale + fps from options", () => {
    const joined = args.join(" ");
    expect(joined).toContain("scale=1280:720");
    expect(joined).toContain("fps=30");
    expect(args[args.indexOf("-crf") + 1]).toBe("18");
  });

  it("omits the head trim by default", () => {
    expect(args).not.toContain("-ss");
  });

  it("trims the head with an input-side seek before -i when startOffsetSeconds is set", () => {
    const trimmed = buildTranscodeArgs({
      inputPath: "in.webm",
      outputPath: "out.mp4",
      fps: 30,
      width: 1280,
      height: 720,
      crf: 18,
      startOffsetSeconds: 1.25,
    });
    expect(trimmed[trimmed.indexOf("-ss") + 1]).toBe("1.250");
    expect(trimmed.indexOf("-ss")).toBeLessThan(trimmed.indexOf("-i")); // input-side seek (fast + accurate)
  });

  it("treats a zero or negative offset as no trim", () => {
    const zero = buildTranscodeArgs({
      inputPath: "in.webm",
      outputPath: "out.mp4",
      fps: 30,
      width: 1280,
      height: 720,
      crf: 18,
      startOffsetSeconds: 0,
    });
    expect(zero).not.toContain("-ss");
  });

  it("clamps the output length with an output-side -t when durationSeconds is set", () => {
    const clamped = buildTranscodeArgs({
      inputPath: "in.webm",
      outputPath: "out.mp4",
      fps: 30,
      width: 1280,
      height: 720,
      crf: 18,
      startOffsetSeconds: 1.5,
      durationSeconds: 7.25,
    });
    expect(clamped[clamped.indexOf("-t") + 1]).toBe("7.250");
    expect(clamped.indexOf("-t")).toBeGreaterThan(clamped.indexOf("-i")); // output-side limit
    expect(clamped.indexOf("-t")).toBeLessThan(clamped.length - 1); // before the output path
  });

  it("omits -t by default", () => {
    expect(args).not.toContain("-t");
  });
});

describe("buildFramePipeArgs", () => {
  const args = buildFramePipeArgs({
    fps: 30,
    width: 1080,
    height: 1350,
    crf: 20,
    outPath: "out.mp4",
    preset: "ultrafast",
  });

  it("reads piped JPEG frames at the given framerate", () => {
    const joined = args.join(" ");
    expect(joined).toContain("-f image2pipe");
    expect(joined).toContain("-framerate 30");
    expect(args[args.indexOf("-i") + 1]).toBe("pipe:0");
  });

  it("scales frames to the output size and encodes h264", () => {
    const joined = args.join(" ");
    expect(joined).toContain("scale=1080:1350");
    expect(args).toContain("libx264");
    expect(args).toContain("yuv420p");
    expect(args[args.indexOf("-preset") + 1]).toBe("ultrafast");
    expect(args[args.length - 1]).toBe("out.mp4");
  });
});

describe("buildConcatArgs", () => {
  const args = buildConcatArgs("list.txt", "out.mp4");

  it("uses the concat demuxer with stream copy (no re-encode)", () => {
    const joined = args.join(" ");
    expect(joined).toContain("-f concat");
    expect(joined).toContain("-safe 0");
    expect(args[args.indexOf("-i") + 1]).toBe("list.txt");
    expect(joined).toContain("-c copy");
    expect(args[args.length - 1]).toBe("out.mp4");
  });
});
