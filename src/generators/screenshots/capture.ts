import type { Browser, Page } from "playwright-core";
import type { Logger } from "@/utils/logger";
import { prepareScroll } from "@/generators/scroll-reel/scroll";
import type { ResolvedScreenshotsOptions } from "@/generators/screenshots/options";

/** Minimum settle at the bottom for lazy/below-the-fold content (esp. for fullPage shots). */
const MIN_PREPARE_SETTLE_MS = 600;

export interface Shot {
  /** Suffix appended to the asset name for the filename + manifest id. */
  key: string;
  buffer: Buffer;
}

export interface CaptureArgs {
  browser: Browser;
  url: string;
  options: ResolvedScreenshotsOptions;
  logger: Logger;
}

type PageShotOptions = NonNullable<Parameters<Page["screenshot"]>[0]>;

/** Capture page (and optional element) screenshots across every configured breakpoint. */
export async function captureScreenshots(args: CaptureArgs): Promise<Shot[]> {
  const { browser, url, options, logger } = args;
  const shots: Shot[] = [];

  for (const bp of options.breakpoints) {
    const context = await browser.newContext({
      viewport: { width: bp.width, height: bp.height },
      deviceScaleFactor: bp.deviceScaleFactor ?? options.deviceScaleFactor,
    });
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
      shots.push({ key: bp.name, buffer: await page.screenshot(pageShotOptions) });

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
        // throw; warn + skip it instead of aborting the whole breakpoint loop.
        try {
          shots.push({
            key: `${bp.name}-${element.name}`,
            buffer: await locator.screenshot(elShotOptions),
          });
        } catch (err) {
          logger.warn(
            `[${bp.name}] could not capture "${element.selector}": ${(err as Error).message}`,
          );
        }
      }
    } finally {
      await context.close();
    }
  }

  return shots;
}
