import type { Page } from "playwright-core";
import type { ResolvedScrollReelOptions } from "@/generators/scroll-reel/options";
import type { Logger } from "@/utils/logger";

export interface CleanCssOptions {
  hideSelectors: string[];
  hideScrollbars: boolean;
  pauseAnimations: boolean;
  injectCss?: string;
}

/**
 * Pure: assemble the CSS injected to suppress capture noise. Returns "" when nothing is requested, so
 * callers can skip the (otherwise empty) style tag. Unit-tested.
 */
export function buildCleanCss(opts: CleanCssOptions): string {
  const parts: string[] = [];
  if (opts.hideSelectors.length > 0) {
    parts.push(`${opts.hideSelectors.join(", ")} { display: none !important; }`);
  }
  if (opts.hideScrollbars) {
    parts.push(
      `::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }`,
      `html { scrollbar-width: none !important; }`,
    );
  }
  if (opts.pauseAnimations) {
    parts.push(
      `*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }`,
    );
  }
  if (opts.injectCss && opts.injectCss.trim()) {
    parts.push(opts.injectCss);
  }
  return parts.join("\n");
}

/**
 * Runs in the page via addInitScript (before any page script, on every navigation): pin the wall clock
 * and randomness so time-/random-driven content renders identically across frames and runs. Best-effort
 * by design — it overrides `Date.now` / `performance.now` / `Math.random` but not the `Date` constructor
 * or the rAF timestamp, so it won't break apps that read `new Date()`; pair with `pauseAnimations` (CSS)
 * for visual stillness. Must be self-contained (serialized into the page).
 */
export function freezeClockScript(): void {
  try {
    const FIXED = 1700000000000; // a fixed epoch (2023-11-14) so the page never sees time advance
    Date.now = () => FIXED;
  } catch {
    /* ignore */
  }
  try {
    const perf = (globalThis as { performance?: { now: () => number } }).performance;
    if (perf) perf.now = () => 0;
  } catch {
    /* ignore */
  }
  try {
    let seed = 1234567;
    Math.random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  } catch {
    /* ignore */
  }
}

/** Install pre-navigation hooks (must run BEFORE `page.goto`). */
export async function installPreNav(page: Page, opts: ResolvedScrollReelOptions): Promise<void> {
  if (opts.freezeClock) {
    await page.addInitScript(freezeClockScript);
  }
}

/** Apply post-navigation cleanup: inject suppression CSS, then dismiss overlays (best-effort). */
export async function applyPostNav(
  page: Page,
  opts: ResolvedScrollReelOptions,
  logger: Logger,
): Promise<void> {
  const css = buildCleanCss({
    hideSelectors: opts.hideSelectors,
    hideScrollbars: opts.hideScrollbars,
    pauseAnimations: opts.pauseAnimations,
    injectCss: opts.injectCss,
  });
  if (css) {
    await page.addStyleTag({ content: css });
  }
  for (const selector of opts.clickSelectors) {
    try {
      await page.click(selector, { timeout: 1000 });
      logger.debug(`dismissed overlay via ${selector}`);
    } catch {
      // Not present / not clickable — fine, these are best-effort consent dismissals.
    }
  }
}
