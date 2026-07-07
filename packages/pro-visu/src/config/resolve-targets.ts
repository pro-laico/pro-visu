import type { ResolvedAssetSpec } from "@/config/schema";

/** Resolve an author URL against the base (absolute inputs pass through unchanged). */
function resolveAgainst(value: string, base: string): string {
  return new URL(value, base).toString();
}

/**
 * With a managed server, its URL is the default base for capture targets: a url-based asset that
 * omits `url` captures the server root, and any relative `url` is resolved against it. Absolute
 * URLs pass through unchanged. With no base (no managed server), assets are returned unchanged —
 * explicit absolute URLs are then required, as before. Pure (no mutation).
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
    return { ...asset, url };
  });
}
