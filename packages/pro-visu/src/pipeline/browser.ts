import { chromium } from "playwright-core";
import type { Browser } from "playwright-core";
import type { ResolvedBrowserSettings } from "@/config/schema";

/** Launch Chromium with the repo's browser settings. */
export async function launchBrowser(settings: ResolvedBrowserSettings): Promise<Browser> {
  return chromium.launch({
    headless: settings.headless,
    channel: settings.channel,
    executablePath: settings.executablePath,
    args: settings.args,
    timeout: settings.launchTimeoutMs,
  });
}
