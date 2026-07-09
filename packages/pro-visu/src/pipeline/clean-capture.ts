import type { Page } from "playwright-core";

import type { Logger } from "@/utils/logger";
import type { ResolvedCaptureSettings } from "@/config/schema";

/**
 * Tool-side capture cleanup, driven by `settings.capture` and applied uniformly to every
 * URL-based capture (scroll-reel, screenshots, interaction): suppression CSS, overlay
 * dismissal, tracker blocking, and the clock freeze. Page-variant extras a generator owns
 * (e.g. scroll-reel's `themeClass`) ride in via {@link PageVariantExtras}.
 */
export interface PageVariantExtras {
  /** Class added to <html> before capture (e.g. to trigger a CSS-class dark theme). */
  themeClass?: string;
}

export interface CleanCssOptions { hideSelectors: string[]; hideScrollbars: boolean; pauseAnimations: boolean; injectCss?: string }

/**
 * Pure: assemble the CSS injected to suppress capture noise. Returns "" when nothing is requested, so
 * callers can skip the (otherwise empty) style tag. Unit-tested.
 */
export function buildCleanCss(opts: CleanCssOptions): string {
  const parts: string[] = [];
  if (opts.hideSelectors.length > 0) parts.push(`${opts.hideSelectors.join(", ")} { display: none !important; }`);
  if (opts.hideScrollbars) {
    parts.push(
      `::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }`,
      `html { scrollbar-width: none !important; }`,
    );
  }
  if (opts.pauseAnimations) {
    parts.push(`*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }`);
  }
  if (opts.injectCss && opts.injectCss.trim()) parts.push(opts.injectCss);
  return parts.join("\n");
}

/**
 * Runs in the page via addInitScript (before any page script, on every navigation): pin the wall clock
 * and randomness so time-/random-driven content renders identically across frames and runs. Best-effort
 * by design — it overrides `Date.now` / `performance.now` / `Math.random` but not the `Date` constructor
 * or the rAF timestamp, so it won't break apps that read `new Date()`; pair with `pauseAnimations` (CSS)
 * for visual stillness. Must be self-contained (serialized into the page).
 */
function freezeClockScript(): void {
  try {
    const FIXED = 1700000000000;
    Date.now = () => FIXED;
  } catch {}
  try {
    const perf = (globalThis as { performance?: { now: () => number } }).performance;
    if (perf) perf.now = () => 0;
  } catch {}
  try {
    let seed = 1234567;
    Math.random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  } catch {}
}

/** Common analytics / ads / tag-manager / session-replay hosts, blocked by default for clean captures. */
export const DEFAULT_TRACKER_HOSTS = [
  "google-analytics.com",
  "googletagmanager.com",
  "googlesyndication.com",
  "doubleclick.net",
  "adservice.google.com",
  "connect.facebook.net",
  "facebook.com/tr",
  "hotjar.com",
  "hotjar.io",
  "segment.com",
  "segment.io",
  "mixpanel.com",
  "amplitude.com",
  "fullstory.com",
  "clarity.ms",
  "sentry.io",
  "intercom.io",
  "intercomcdn.com",
  "analytics.tiktok.com",
  "snap.licdn.com",
  "bat.bing.com",
];

/** Pure: should a request be aborted, given the host denylist and blocked resource types? */
export function shouldBlockRequest(
  url: string,
  opts: { hosts: string[]; resourceTypes: string[]; resourceType: string },
): boolean {
  if (opts.resourceTypes.includes(opts.resourceType)) return true;
  return opts.hosts.some((h) => url.includes(h));
}

/** Abort tracker/denylisted/blocked-type requests during capture (must run BEFORE `page.goto`). */
export async function installNetworkHygiene(page: Page, capture: ResolvedCaptureSettings): Promise<void> {
  const { blockTrackers, blockHosts, blockResourceTypes } = capture.cleanup;
  const hosts = [...(blockTrackers ? DEFAULT_TRACKER_HOSTS : []), ...blockHosts];
  const resourceTypes = blockResourceTypes;
  if (hosts.length === 0 && resourceTypes.length === 0) return;
  await page.route("**/*", (route) => {
    const req = route.request();
    if (shouldBlockRequest(req.url(), { hosts, resourceTypes, resourceType: req.resourceType() })) return route.abort();
    return route.fallback();
  });
}

/**
 * Runs in the page: pause and rewind all media so autoplay video/audio can't make frames depend on
 * wall-clock time (frame-stepping screenshots a static page). Self-contained (serialized into the page).
 */
function pauseAllMedia(): void {
  const doc = (globalThis as { document?: { querySelectorAll(s: string): ArrayLike<unknown> } }).document;
  if (!doc) return;
  try {
    const media = doc.querySelectorAll("video, audio");
    for (let i = 0; i < media.length; i++) {
      const m = media[i] as { autoplay?: boolean; pause?: () => void; currentTime?: number };
      try {
        m.autoplay = false;
        m.pause?.();
        if (typeof m.currentTime === "number") m.currentTime = 0;
      } catch {}
    }
  } catch {}
}

/** Runs in the page: add a theme class to <html> (e.g. to force a dark variant). Self-contained. */
function applyThemeClass(cls: string): void {
  try {
    (
      globalThis as { document?: { documentElement?: { classList?: { add(c: string): void } } } }
    ).document?.documentElement?.classList?.add(cls);
  } catch {}
}

/** Install pre-navigation hooks (must run BEFORE `page.goto`). */
export async function installPreNav(
  page: Page,
  capture: ResolvedCaptureSettings,
  extras: PageVariantExtras = {},
): Promise<void> {
  if (capture.cleanup.freezeClock) await page.addInitScript(freezeClockScript);
  if (extras.themeClass) await page.addInitScript(applyThemeClass, extras.themeClass);
}

/**
 * Apply post-navigation cleanup: inject suppression CSS, then dismiss overlays (best-effort), and
 * pause media so autoplay video can't make frames depend on wall-clock time. `pauseMedia: false`
 * keeps media playing (realtime recordings that WANT autoplay motion).
 */
export async function applyPostNav(
  page: Page,
  capture: ResolvedCaptureSettings,
  logger: Logger,
  extras: PageVariantExtras & { pauseMedia?: boolean } = {},
): Promise<void> {
  const css = buildCleanCss({
    hideSelectors: capture.cleanup.hideSelectors,
    hideScrollbars: capture.cleanup.hideScrollbars,
    pauseAnimations: capture.cleanup.pauseAnimations,
    injectCss: capture.cleanup.injectCss,
  });
  if (css) await page.addStyleTag({ content: css });
  if (extras.themeClass) await page.evaluate(applyThemeClass, extras.themeClass);
  for (const selector of capture.cleanup.clickSelectors) {
    try {
      await page.click(selector, { timeout: 1000 });
      logger.debug(`dismissed overlay via ${selector}`);
    } catch {}
  }
  if (extras.pauseMedia !== false) await page.evaluate(pauseAllMedia);
}
