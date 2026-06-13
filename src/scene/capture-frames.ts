import path from "node:path";
import type { Browser } from "playwright-core";
import { concatMp4, startFrameEncoder } from "@/media/ffmpeg";
import type { Logger } from "@/utils/logger";

export interface FrameCaptureArgs {
  browser: Browser;
  url: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  fps: number;
  durationSeconds: number;
  crf: number;
  /** Absolute mp4 path to write. */
  outPath: string;
  /** "ultrafast" in draft, "medium" otherwise. */
  preset?: string;
  /** JPEG quality for intermediate frames (perf vs fidelity). */
  jpegQuality?: number;
  /** Parallel render workers (each its own browser context). Default 1. */
  workers?: number;
  /** Scratch dir for per-worker segments. */
  tmpDir: string;
  logger: Logger;
}

interface ChunkArgs {
  browser: Browser;
  url: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  fps: number;
  crf: number;
  preset?: string;
  jpegQuality: number;
  /** Seconds advanced per frame (duration / totalFrames) — see captureSceneFrames. */
  timeStep: number;
  /** Inclusive start frame, exclusive end frame. */
  frameStart: number;
  frameEnd: number;
  outPath: string;
  logger: Logger;
}

/** Render a contiguous frame range in its own browser context, encoding to one mp4 segment. */
async function renderChunk(a: ChunkArgs): Promise<void> {
  const context = await a.browser.newContext({
    viewport: { width: a.width, height: a.height },
    deviceScaleFactor: a.deviceScaleFactor,
  });
  const page = await context.newPage();
  page.on("console", (m) => a.logger.debug(`[scene] ${m.text()}`));
  page.on("pageerror", (e) => a.logger.debug(`[scene error] ${e.message}`));

  try {
    await page.goto(a.url, { waitUntil: "load" });
    await page.waitForFunction(
      () => (globalThis as { __showcaseReady?: boolean }).__showcaseReady === true,
      undefined,
      { timeout: 30_000 },
    );

    const encoder = startFrameEncoder(
      { fps: a.fps, width: a.width, height: a.height, crf: a.crf, outPath: a.outPath, preset: a.preset },
      a.logger,
    );
    for (let frame = a.frameStart; frame < a.frameEnd; frame++) {
      const t = frame * a.timeStep;
      await page.evaluate(
        (tt) =>
          (globalThis as { __showcase?: { seek(t: number): Promise<void> } }).__showcase?.seek(tt),
        t,
      );
      const buf = await page.screenshot({ type: "jpeg", quality: a.jpegQuality });
      await encoder.write(buf);
    }
    await encoder.done();
  } finally {
    await context.close();
  }
}

/**
 * Deterministic capture: seek each video to the exact time per frame, screenshot, and pipe
 * straight into ffmpeg — frame-accurate and machine-independent, no frames touch disk. With
 * `workers > 1`, the frame range is split into contiguous segments rendered in parallel
 * contexts, then losslessly concatenated (the determinism is what makes this safe).
 */
export async function captureSceneFrames(args: FrameCaptureArgs): Promise<void> {
  const totalFrames = Math.max(1, Math.round(args.durationSeconds * args.fps));
  // Step time as duration/totalFrames (≈ 1/fps) so the N frames evenly tile [0, duration). The
  // frame that would sit at t=duration is the loop point — which equals t=0 for a seamless scene —
  // so omitting it (we render 0..N-1) makes the last→first wrap exactly one step: no seam hitch.
  const timeStep = args.durationSeconds / totalFrames;
  const workers = Math.max(1, Math.min(args.workers ?? 1, totalFrames));
  const jpegQuality = args.jpegQuality ?? 90;
  const common = {
    browser: args.browser,
    url: args.url,
    width: args.width,
    height: args.height,
    deviceScaleFactor: args.deviceScaleFactor,
    fps: args.fps,
    crf: args.crf,
    preset: args.preset,
    jpegQuality,
    timeStep,
    logger: args.logger,
  };

  if (workers === 1) {
    args.logger.debug(`stepping ${totalFrames} frames @ ${args.fps}fps`);
    await renderChunk({ ...common, frameStart: 0, frameEnd: totalFrames, outPath: args.outPath });
    return;
  }

  const chunk = Math.ceil(totalFrames / workers);
  const ranges: Array<{ start: number; end: number; seg: string }> = [];
  for (let w = 0; w < workers; w++) {
    const start = w * chunk;
    const end = Math.min(totalFrames, start + chunk);
    if (start >= end) break;
    ranges.push({ start, end, seg: path.join(args.tmpDir, `seg-${w}-${path.basename(args.outPath)}`) });
  }
  args.logger.debug(`stepping ${totalFrames} frames across ${ranges.length} workers`);

  await Promise.all(
    ranges.map((r) =>
      renderChunk({ ...common, frameStart: r.start, frameEnd: r.end, outPath: r.seg }),
    ),
  );
  await concatMp4(
    ranges.map((r) => r.seg),
    args.outPath,
    args.logger,
  );
}
