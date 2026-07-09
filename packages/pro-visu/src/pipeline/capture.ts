import type { BrowserContext } from "playwright-core";
import type { ResolvedCaptureSettings, ResolvedCaptureOverride } from "@/config/schema";

/** Union two string lists, de-duplicated, order-preserving (base entries first). */
function union(base: string[] | undefined, extra: string[] | undefined): string[] {
  return [...new Set([...(base ?? []), ...(extra ?? [])])];
}

/** Drop `minus` entries from `list` (the subtraction escapes). */
function without(list: string[], minus: string[] | undefined): string[] {
  if (!minus?.length) return list;
  const drop = new Set(minus);
  return list.filter((entry) => !drop.has(entry));
}

/** Join two optional CSS/JS blobs so both apply (base first); undefined when both are empty. */
function joinText(base: string | undefined, extra: string | undefined): string | undefined {
  const parts = [base, extra].filter((s): s is string => Boolean(s));
  return parts.length ? parts.join("\n") : undefined;
}

/** Merge cookie lists by name (override wins); undefined when neither has any. */
function mergeCookies(
  base: { name: string; value: string }[] | undefined,
  extra: { name: string; value: string }[] | undefined,
): { name: string; value: string }[] | undefined {
  if (!base?.length && !extra?.length) return undefined;
  const byName = new Map<string, { name: string; value: string }>();
  for (const c of base ?? []) byName.set(c.name, c);
  for (const c of extra ?? []) byName.set(c.name, c);
  return [...byName.values()];
}

/** A record merge that stays `undefined` when the result is empty (preserves "no signal"). */
function mergeRecord(
  base: Record<string, string> | undefined,
  extra: Record<string, string> | undefined,
): Record<string, string> | undefined {
  const merged = { ...base, ...extra };
  return Object.keys(merged).length ? merged : undefined;
}

/**
 * Resolve an asset's effective capture settings by layering its override over the global ones.
 * Booleans/strings the override sets win (omit to inherit); record + cookie signals merge; array
 * cleanups are ADDITIVE (unioned with the globals); and `showSelectors` / `unblockHosts` subtract
 * inherited entries. No override → the globals are returned unchanged (identical hash → no cache
 * churn for assets that don't override).
 */
export function resolveAssetCapture(
  global: ResolvedCaptureSettings,
  override: ResolvedCaptureOverride | undefined,
): ResolvedCaptureSettings {
  if (!override) return global;
  const g = global;
  const os = override.signals;
  const oc = override.cleanup;
  return {
    signals: {
      query: mergeRecord(g.signals.query, os?.query),
      cookies: mergeCookies(g.signals.cookies, os?.cookies),
      localStorage: mergeRecord(g.signals.localStorage, os?.localStorage),
      initScript: joinText(g.signals.initScript, os?.initScript),
    },
    cleanup: {
      hideSelectors: without(union(g.cleanup.hideSelectors, oc?.hideSelectors), oc?.showSelectors),
      clickSelectors: union(g.cleanup.clickSelectors, oc?.clickSelectors),
      injectCss: joinText(g.cleanup.injectCss, oc?.injectCss),
      hideScrollbars: oc?.hideScrollbars ?? g.cleanup.hideScrollbars,
      pauseAnimations: oc?.pauseAnimations ?? g.cleanup.pauseAnimations,
      freezeClock: oc?.freezeClock ?? g.cleanup.freezeClock,
      blockTrackers: oc?.blockTrackers ?? g.cleanup.blockTrackers,
      blockHosts: without(union(g.cleanup.blockHosts, oc?.blockHosts), oc?.unblockHosts),
      blockResourceTypes: union(g.cleanup.blockResourceTypes, oc?.blockResourceTypes),
    },
  };
}

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
