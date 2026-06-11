import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import type { Browser } from "playwright-core";
import type { Logger } from "@/utils/logger";
import { ensureDir } from "@/utils/fs";
import { pageScroll } from "@/generators/scroll-reel/scroll";
import type { ResolvedScrollReelOptions } from "@/generators/scroll-reel/options";

export interface CaptureArgs {
  browser: Browser;
  url: string;
  options: ResolvedScrollReelOptions;
  /** Scratch root; a unique recording subdir is created inside. */
  tmpDir: string;
  logger: Logger;
}

export interface CaptureResult {
  /** Absolute path to the recorded .webm. */
  webmPath: string;
}

/**
 * Open a recording context, navigate, run the eased scroll, then close to finalize the
 * webm. Returns the recording path for downstream transcoding.
 */
export async function captureScrollWebm(args: CaptureArgs): Promise<CaptureResult> {
  const { browser, url, options, tmpDir, logger } = args;
  await ensureDir(tmpDir);
  const recordDir = await mkdtemp(path.join(tmpDir, "rec-"));

  const context = await browser.newContext({
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: options.deviceScaleFactor,
    recordVideo: {
      dir: recordDir,
      size: { width: options.width, height: options.height },
    },
  });
  const page = await context.newPage();
  const video = page.video();

  try {
    logger.debug(`navigating to ${url} (waitUntil=${options.waitUntil})`);
    await page.goto(url, { waitUntil: options.waitUntil });
    if (options.waitForSelector) {
      logger.debug(`waiting for selector ${options.waitForSelector}`);
      await page.waitForSelector(options.waitForSelector, { state: "visible" });
    }
    await page.evaluate(pageScroll, {
      durationMs: options.duration,
      easing: options.easing,
      startDelayMs: options.startDelayMs,
      endDwellMs: options.endDwellMs,
    });
  } finally {
    // Closing the context flushes + finalizes the recording file.
    await context.close();
  }

  if (!video) {
    throw new Error("Playwright did not record a video (recordVideo inactive).");
  }
  return { webmPath: await video.path() };
}
