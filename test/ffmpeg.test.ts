import { describe, expect, it } from "vitest";
import {
  buildTranscodeArgs,
  buildFramePipeArgs,
  buildConcatArgs,
  aspectTarget,
  buildAspectArgs,
  buildGifArgs,
  buildWebpArgs,
  buildPosterArgs,
  buildStillSegmentArgs,
} from "@/media/ffmpeg";

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

  it("converts and tags the output as bt709 tv-range", () => {
    const vf = args[args.indexOf("-vf") + 1] ?? "";
    // scale performs the conversion with a declared matrix; format=yuv420p directly after scale
    // makes scale itself do the (R)GB/601→709 conversion rather than a later untagged converter.
    expect(vf).toContain("out_color_matrix=bt709:out_range=tv,format=yuv420p");
    expect(args[args.indexOf("-colorspace") + 1]).toBe("bt709");
    expect(args[args.indexOf("-color_primaries") + 1]).toBe("bt709");
    expect(args[args.indexOf("-color_trc") + 1]).toBe("bt709");
    expect(args[args.indexOf("-color_range") + 1]).toBe("tv");
  });

  it("defaults the preset to medium and honors an override (draft)", () => {
    expect(args[args.indexOf("-preset") + 1]).toBe("medium");
    const draft = buildTranscodeArgs({
      inputPath: "in.webm",
      outputPath: "out.mp4",
      fps: 30,
      width: 1280,
      height: 720,
      crf: 18,
      preset: "ultrafast",
    });
    expect(draft[draft.indexOf("-preset") + 1]).toBe("ultrafast");
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

  it("declares the piped input codec explicitly: mjpeg by default, png for the lossless path", () => {
    // The first -c:v is an input option (before -i); the second is the libx264 output codec.
    expect(args[args.indexOf("-c:v") + 1]).toBe("mjpeg");
    const png = buildFramePipeArgs({
      fps: 30,
      width: 1080,
      height: 1350,
      crf: 20,
      outPath: "out.mp4",
      inputFormat: "png",
    });
    expect(png[png.indexOf("-c:v") + 1]).toBe("png");
    expect(png.indexOf("-c:v")).toBeLessThan(png.indexOf("-i")); // input-side option
  });

  it("converts and tags the output as bt709 tv-range", () => {
    const vf = args[args.indexOf("-vf") + 1] ?? "";
    expect(vf).toContain("out_color_matrix=bt709:out_range=tv,format=yuv420p");
    expect(args[args.indexOf("-colorspace") + 1]).toBe("bt709");
    expect(args[args.indexOf("-color_range") + 1]).toBe("tv");
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

describe("aspectTarget", () => {
  it("maps presets to dimensions", () => {
    expect(aspectTarget("16:9")).toEqual({ width: 1920, height: 1080 });
    expect(aspectTarget("9:16")).toEqual({ width: 1080, height: 1920 });
    expect(aspectTarget("1:1")).toEqual({ width: 1080, height: 1080 });
  });
  it("passes explicit sizes through", () => {
    expect(aspectTarget({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 });
  });
});

describe("buildAspectArgs", () => {
  it("cover scales-to-fill then center-crops, keeping color tags", () => {
    const a = buildAspectArgs({
      inputPath: "in.mp4",
      outputPath: "out.mp4",
      width: 1080,
      height: 1920,
      fit: "cover",
      padColor: "#000",
      fps: 30,
      crf: 18,
    });
    const f = a[a.indexOf("-vf") + 1]!;
    expect(f).toContain("force_original_aspect_ratio=increase");
    expect(f).toContain("crop=1080:1920");
    expect(f).toContain("out_color_matrix=bt709");
    expect(a).toContain("libx264");
    expect(a).toContain("-colorspace");
  });

  it("contain scales-to-fit then pads with the pad color", () => {
    const a = buildAspectArgs({
      inputPath: "in.mp4",
      outputPath: "out.mp4",
      width: 1080,
      height: 1080,
      fit: "contain",
      padColor: "#0b0b0f",
      fps: 30,
      crf: 18,
    });
    const f = a[a.indexOf("-vf") + 1]!;
    expect(f).toContain("force_original_aspect_ratio=decrease");
    expect(f).toContain("pad=1080:1080");
    expect(f).toContain("#0b0b0f");
  });
});

describe("buildGifArgs", () => {
  it("builds a two-stage palette gif", () => {
    const a = buildGifArgs({ inputPath: "in.mp4", outputPath: "out.gif", fps: 15 });
    const f = a[a.indexOf("-filter_complex") + 1]!;
    expect(f).toContain("fps=15");
    expect(f).toContain("palettegen");
    expect(f).toContain("paletteuse");
    expect(a[a.length - 1]).toBe("out.gif");
  });
  it("includes a scale when width is set", () => {
    const a = buildGifArgs({ inputPath: "in.mp4", outputPath: "out.gif", fps: 12, width: 480 });
    expect(a[a.indexOf("-filter_complex") + 1]!).toContain("scale=480:-1");
  });
});

describe("buildWebpArgs", () => {
  it("uses libwebp with a looping animation", () => {
    const a = buildWebpArgs({ inputPath: "in.mp4", outputPath: "out.webp", fps: 15, quality: 75 });
    expect(a).toContain("libwebp");
    expect(a[a.indexOf("-q:v") + 1]).toBe("75");
    expect(a[a.indexOf("-loop") + 1]).toBe("0");
    expect(a[a.length - 1]).toBe("out.webp");
  });
});

describe("buildPosterArgs", () => {
  it("grabs one frame from the start by default", () => {
    const a = buildPosterArgs({ inputPath: "in.mp4", outputPath: "out.png", atSeconds: 0 });
    expect(a).not.toContain("-ss");
    expect(a[a.indexOf("-frames:v") + 1]).toBe("1");
  });
  it("seeks when atSeconds > 0", () => {
    const a = buildPosterArgs({ inputPath: "in.mp4", outputPath: "out.png", atSeconds: 1.5 });
    expect(a[a.indexOf("-ss") + 1]).toBe("1.500");
  });
});

describe("buildStillSegmentArgs", () => {
  it("loops a still for the duration with fade in/out and color tags", () => {
    const a = buildStillSegmentArgs({
      pngPath: "card.png",
      outPath: "card.mp4",
      seconds: 2,
      fps: 30,
      width: 1920,
      height: 1080,
      fadeInSec: 0.4,
      fadeOutSec: 0.4,
      crf: 18,
    });
    expect(a).toContain("-loop");
    expect(a[a.indexOf("-t") + 1]).toBe("2.000");
    const f = a[a.indexOf("-vf") + 1]!;
    expect(f).toContain("fade=t=in:st=0:d=0.400");
    expect(f).toContain("fade=t=out:st=1.600:d=0.400"); // 2 − 0.4
    expect(f).toContain("out_color_matrix=bt709");
    expect(a).toContain("libx264");
  });

  it("omits fades when zero", () => {
    const a = buildStillSegmentArgs({
      pngPath: "c.png",
      outPath: "c.mp4",
      seconds: 1,
      fps: 30,
      width: 100,
      height: 100,
      fadeInSec: 0,
      fadeOutSec: 0,
      crf: 18,
    });
    expect(a[a.indexOf("-vf") + 1]!).not.toContain("fade");
  });
});
