import type { BrowserContext } from "playwright-core";
import type { ResolvedCaptureSettings } from "@/config/schema";

/**
 * Append the configured capture query params to a URL. Absolute URLs get the params; a value that
 * isn't a parseable absolute URL (a bare `/path`, or empty) is returned unchanged — base-resolution
 * already happened in `resolveTargets`, and a relative route still inherits the context's cookies.
 */
export function withCaptureQuery(
  url: string | undefined,
  capture: ResolvedCaptureSettings | undefined,
): string | undefined {
  if (!url || !capture?.signals.query) return url;
  try {
    const u = new URL(url);
    for (const [k, v] of Object.entries(capture.signals.query)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Seed capture-mode state onto a fresh context BEFORE its first navigation: cookies (scoped to the
 * asset's origin), localStorage, and an init script — so every page (and every in-app navigation
 * within a multi-route reel) renders in capture mode. No-op when capture is unset. Failures here are
 * non-fatal: a bad origin just skips the cookies; the capture still proceeds.
 */
export async function applyCapture(
  context: BrowserContext,
  capture: ResolvedCaptureSettings | undefined,
  url: string | undefined,
): Promise<void> {
  if (!capture) return;
  const { cookies, localStorage, initScript } = capture.signals;

  if (cookies?.length && url) {
    try {
      const origin = new URL(url).origin;
      await context.addCookies(
        cookies.map((c) => ({ name: c.name, value: c.value, url: origin })),
      );
    } catch {
      /* non-absolute url → can't scope cookies; skip them */
    }
  }

  const scripts: string[] = [];
  if (localStorage) {
    // Runs before the page's own scripts (addInitScript), so values are present on first read.
    scripts.push(
      `try{var e=${JSON.stringify(localStorage)};for(var k in e)localStorage.setItem(k,e[k]);}catch(_){}`,
    );
  }
  if (initScript) scripts.push(initScript);
  if (scripts.length) await context.addInitScript(scripts.join("\n"));
}
