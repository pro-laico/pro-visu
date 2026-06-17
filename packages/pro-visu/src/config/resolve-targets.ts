import type { ResolvedAssetSpec } from "@/config/schema";

/** Resolve an author URL/route against the base (absolute inputs pass through unchanged). */
function resolveAgainst(value: string, base: string): string {
  return new URL(value, base).toString();
}

/** Resolve any relative entries in a `routes` option (string or `{ url }` object forms). */
function resolveRoutes(
  options: Record<string, unknown>,
  base: string,
): Record<string, unknown> {
  const routes = options.routes;
  if (!Array.isArray(routes)) return options;
  const resolved = routes.map((route) => {
    if (typeof route === "string") return resolveAgainst(route, base);
    if (
      route &&
      typeof route === "object" &&
      typeof (route as { url?: unknown }).url === "string"
    ) {
      const r = route as Record<string, unknown> & { url: string };
      return { ...r, url: resolveAgainst(r.url, base) };
    }
    return route;
  });
  return { ...options, routes: resolved };
}

/**
 * With a managed server, its URL is the default base for capture targets: a url-based asset that
 * omits `url` captures the server root, and any relative `url` or `routes` entry is resolved
 * against it. Absolute URLs pass through unchanged. With no base (no managed server), assets are
 * returned unchanged — explicit absolute URLs are then required, as before. Pure (no mutation).
 */
export function resolveTargets(
  assets: ResolvedAssetSpec[],
  base: string | undefined,
  requiresUrl: (generatorId: string) => boolean,
): ResolvedAssetSpec[] {
  if (!base) return assets;
  return assets.map((asset) => {
    const url =
      asset.url == null
        ? requiresUrl(asset.generator)
          ? base
          : asset.url
        : resolveAgainst(asset.url, base);
    return { ...asset, url, options: resolveRoutes(asset.options, base) };
  });
}
