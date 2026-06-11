import type { Browser, Page } from "playwright-core";
import type { Logger } from "@/utils/logger";
import type { ResolvedScreenshotsOptions } from "@/generators/screenshots/options";

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
      if (options.settleMs > 0) await page.waitForTimeout(options.settleMs);

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
        shots.push({
          key: `${bp.name}-${element.name}`,
          buffer: await locator.screenshot(elShotOptions),
        });
      }
    } finally {
      await context.close();
    }
  }

  return shots;
}
