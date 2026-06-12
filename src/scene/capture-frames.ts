import type { Browser } from "playwright-core";
import { startFrameEncoder } from "@/media/ffmpeg";
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
  logger: Logger;
}

/**
 * Deterministic capture: load the scene, then for each frame seek its videos to the exact
 * time, screenshot, and pipe the frame straight into ffmpeg. Frame-accurate and independent
 * of machine speed — a "6s @ 30fps" clip is always exactly 180 frames. No frames touch disk.
 */
export async function captureSceneFrames(args: FrameCaptureArgs): Promise<void> {
  const context = await args.browser.newContext({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: args.deviceScaleFactor,
  });
  const page = await context.newPage();
  page.on("console", (m) => args.logger.debug(`[scene] ${m.text()}`));
  page.on("pageerror", (e) => args.logger.debug(`[scene error] ${e.message}`));

  try {
    await page.goto(args.url, { waitUntil: "load" });
    await page.waitForFunction(
      () => (globalThis as { __showcaseReady?: boolean }).__showcaseReady === true,
      undefined,
      { timeout: 30_000 },
    );

    const totalFrames = Math.max(1, Math.round(args.durationSeconds * args.fps));
    args.logger.debug(`stepping ${totalFrames} frames @ ${args.fps}fps`);

    const encoder = startFrameEncoder(
      {
        fps: args.fps,
        width: args.width,
        height: args.height,
        crf: args.crf,
        outPath: args.outPath,
        preset: args.preset,
      },
      args.logger,
    );

    for (let frame = 0; frame < totalFrames; frame++) {
      const t = frame / args.fps;
      await page.evaluate(
        (tt) => (globalThis as { __showcase?: { seek(t: number): Promise<void> } }).__showcase?.seek(tt),
        t,
      );
      const buf = await page.screenshot({ type: "jpeg", quality: args.jpegQuality ?? 90 });
      await encoder.write(buf);
    }
    await encoder.done();
  } finally {
    await context.close();
  }
}
