import type { Browser, Page } from "playwright-core";

import type { Logger } from "@/utils/logger";
import { mapLimit } from "@/utils/concurrency";
import { applyCapture } from "@/pipeline/capture";
import type { ResolvedCaptureSettings } from "@/config/schema";
import { prepareScroll } from "@/generators/scroll-reel/scroll";
import type { ResolvedScreenshotsOptions } from "@/generators/screenshots/options";
import { applyPostNav, installNetworkHygiene, installPreNav } from "@/pipeline/clean-capture";

/** Minimum settle at the bottom for lazy/below-the-fold content (esp. for fullPage shots). */
const MIN_PREPARE_SETTLE_MS = 600;

export interface CaptureArgs<T> {
  browser: Browser;
  url: string;
  options: ResolvedScreenshotsOptions;
  logger: Logger;
  capture: ResolvedCaptureSettings;
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
  const perViewport = await mapLimit(options.viewports, Math.min(3, options.viewports.length), (bp) => captureViewport(args, bp));
  return perViewport.flat();
}

/** One viewport: fresh context → navigate → warm the page → page shot + element shots. */
async function captureViewport<T>(args: CaptureArgs<T>, bp: ResolvedScreenshotsOptions["viewports"][number]): Promise<T[]> {
  const { browser, url, options, logger } = args;
  const shots: T[] = [];
  {
    const context = await browser.newContext({
      viewport: { width: bp.width, height: bp.height },
      deviceScaleFactor: bp.deviceScaleFactor ?? options.output.deviceScaleFactor,
    });
    await applyCapture(context, args.capture, url);
    const page = await context.newPage();
    try {
      await installNetworkHygiene(page, args.capture);
      await installPreNav(page, args.capture);
      logger.debug(`[${bp.name}] navigating to ${url}`);
      await page.goto(url, { waitUntil: options.page.waitUntil });
      if (options.page.waitForSelector) await page.waitForSelector(options.page.waitForSelector, { state: "visible" });
      await applyPostNav(page, args.capture, logger);
      await page.evaluate(prepareScroll, { settleMs: Math.max(options.page.settleMs, MIN_PREPARE_SETTLE_MS) });

      const pageShotOptions: PageShotOptions = { type: options.output.format, fullPage: options.fullPage };
      if (options.output.format === "png" && options.output.omitBackground) pageShotOptions.omitBackground = true;
      if (options.output.format === "jpeg" && options.output.quality != null) pageShotOptions.quality = options.output.quality;
      shots.push(await args.persist(bp.name, await page.screenshot(pageShotOptions)));

      for (const element of options.elements) {
        const locator = page.locator(element.selector).first();
        if ((await locator.count()) === 0) {
          logger.warn(`[${bp.name}] selector not found, skipping: ${element.selector}`);
          continue;
        }
        const elShotOptions: PageShotOptions = { type: options.output.format };
        if (options.output.format === "png" && options.output.omitBackground) elShotOptions.omitBackground = true;
        if (options.output.format === "jpeg" && options.output.quality != null) elShotOptions.quality = options.output.quality;
        let buffer: Buffer | null = null;
        try {
          buffer = await locator.screenshot(elShotOptions);
        } catch (err) {
          logger.warn(`[${bp.name}] could not capture "${element.selector}": ${(err as Error).message}`);
        }
        if (buffer) shots.push(await args.persist(`${bp.name}-${element.name}`, buffer));
      }
    } finally {
      await context.close();
    }
  }

  return shots;
}
