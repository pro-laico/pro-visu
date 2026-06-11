import { describe, expect, it } from "vitest";
import { buildTranscodeArgs } from "@/media/ffmpeg";

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
});
