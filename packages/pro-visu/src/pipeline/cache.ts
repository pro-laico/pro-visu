import { createHash } from "node:crypto";

export interface CacheKeyParts {
  /**
   * The asset spec's name. Output filenames derive from it, and the cache check matches records
   * by name prefix — without it in the key, two identically-configured specs whose names prefix
   * each other (e.g. "home" / "home-2") could serve each other's records.
   */
  name?: string;
  generator: string;
  url?: string;
  /** Fully-resolved generator options. */
  options: unknown;
  /** Slot name → producing asset's output contentHash. */
  inputs: Record<string, string>;
  /**
   * Resolved path → content hash of the generator's declared file dependencies (e.g. fonts).
   * Pass `undefined` when there are none — stableStringify drops undefined entries, keeping keys
   * byte-identical for generators that don't use the feature.
   */
  files?: Record<string, string>;
  quality: string;
  toolVersion: string;
  /** Capture-mode toggles — part of the output fingerprint (undefined drops out of the hash). */
  capture?: unknown;
}

/** Deterministic JSON: object keys sorted recursively so the hash is stable. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

/**
 * Fingerprint of everything that determines an asset's output: its generator, options, the
 * content hashes of its inputs, the quality profile, and the tool version (which covers tool
 * + scene-app changes). A stable key here means the cached output is still valid.
 */
export function computeCacheKey(parts: CacheKeyParts): string {
  return createHash("sha256").update(stableStringify(parts)).digest("hex");
}
