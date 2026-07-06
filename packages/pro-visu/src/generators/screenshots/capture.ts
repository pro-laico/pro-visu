import type { Browser, Page } from "playwright-core";
import type { Logger } from "@/utils/logger";
import { mapLimit } from "@/utils/concurrency";
import { applyCapture } from "@/pipeline/capture";
import { prepareScroll } from "@/generators/scroll-reel/scroll";
import type { ResolvedCaptureSettings } from "@/config/schema";
import type { ResolvedScreenshotsOptions } from "@/generators/screenshots/options";

/** Minimum settle at the bottom for lazy/below-the-fold content (esp. for fullPage shots). */
const MIN_PREPARE_SETTLE_MS = 600;

export interface CaptureArgs<T> {
  browser: Browser;
  url: string;
  options: ResolvedScreenshotsOptions;
  logger: Logger;
  capture?: ResolvedCaptureSettings;
  /**
   * Called with each shot's buffer AS SOON as it is captured, so the caller writes it to disk and
   * the buffer is released immediately. Holding every shot until the end multiplies badly: fullPage
   * PNGs at deviceScaleFactor 2 run tens of MB each, and viewports capture in parallel.
   */
  persist: (key: string, buffer: Buffer) => Promise<T>;
}

type PageShotOptions = NonNullable<Parameters<Page["screenshot"]>[0]>;

/**
 * Capture page (and optional element) screenshots across every configured viewport, persisting
 * each buffer the moment it's taken (see `persist`). Viewports render in parallel (each in its own
 * isolated context, modest cap); element shots stay sequential within a viewport. mapLimit
 * preserves input order, so the returned records keep a stable order for filenames/manifest ids.
 */
export async function captureScreenshots<T>(args: CaptureArgs<T>): Promise<T[]> {
  const { options } = args;
  const perViewport = await mapLimit(
    options.viewports,
    Math.min(3, options.viewports.length),
    (bp) => captureViewport(args, bp),
  );
  return perViewport.flat();
}

/** One viewport: fresh context → navigate → warm the page → page shot + element shots. */
async function captureViewport<T>(
  args: CaptureArgs<T>,
  bp: ResolvedScreenshotsOptions["viewports"][number],
): Promise<T[]> {
  const { browser, url, options, logger } = args;
  const shots: T[] = [];
  {
    const context = await browser.newContext({
      viewport: { width: bp.width, height: bp.height },
      deviceScaleFactor: bp.deviceScaleFactor ?? options.deviceScaleFactor,
    });
    await applyCapture(context, args.capture, url);
    const page = await context.newPage();
    try {
      logger.debug(`[${bp.name}] navigating to ${url}`);
      await page.goto(url, { waitUntil: options.waitUntil });
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { state: "visible" });
      }
      // Drive the page so lazy-loaded / intersection-mounted content, web fonts, and image decode
      // are done before we shoot — otherwise fullPage shots capture blank/placeholder regions and
      // fallback fonts. Returns to the top when finished.
      await page.evaluate(prepareScroll, {
        settleMs: Math.max(options.settleMs, MIN_PREPARE_SETTLE_MS),
      });

      const pageShotOptions: PageShotOptions = {
        type: options.format,
        fullPage: options.fullPage,
      };
      if (options.format === "png" && options.omitBackground) {
        pageShotOptions.omitBackground = true;
      }
      if (options.format === "jpeg" && options.quality != null) {
        pageShotOptions.quality = options.quality;
      }
      shots.push(await args.persist(bp.name, await page.screenshot(pageShotOptions)));

      for (const element of options.elements) {
        const locator = page.locator(element.selector).first();
        if ((await locator.count()) === 0) {
          logger.warn(`[${bp.name}] selector not found, skipping: ${element.selector}`);
          continue;
        }
        const elShotOptions: PageShotOptions = { type: options.format };
        if (options.format === "png" && options.omitBackground) {
          elShotOptions.omitBackground = true;
        }
        if (options.format === "jpeg" && options.quality != null) {
          elShotOptions.quality = options.quality;
        }
        // A present-but-hidden element (display:none until interaction) makes locator.screenshot
        // throw; warn + skip it instead of aborting the whole viewport loop. Only the capture is
        // guarded — a persist (disk write) failure is a real error and still propagates.
        let buffer: Buffer | null = null;
        try {
          buffer = await locator.screenshot(elShotOptions);
        } catch (err) {
          logger.warn(
            `[${bp.name}] could not capture "${element.selector}": ${(err as Error).message}`,
          );
        }
        if (buffer) shots.push(await args.persist(`${bp.name}-${element.name}`, buffer));
      }
    } finally {
      await context.close();
    }
  }

  return shots;
}
