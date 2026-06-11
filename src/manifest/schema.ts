import { z } from "zod";

/** One generated asset, recorded in showcase/manifest.json. Keyed by `id` (the asset name). */
export const assetRecordSchema = z.object({
  /** Unique asset id — the asset spec's `name`. */
  id: z.string(),
  generator: z.string(),
  sourceUrl: z.string(),
  /** Path relative to the output dir, forward-slashed. */
  file: z.string(),
  format: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  durationMs: z.number().optional(),
  bytes: z.number().int(),
  /** sha256 of the output file. */
  contentHash: z.string(),
  createdAt: z.string(),
  toolVersion: z.string(),
});
export type AssetRecord = z.infer<typeof assetRecordSchema>;

export const manifestSchema = z.object({
  version: z.literal(1),
  assets: z.array(assetRecordSchema),
});
export type Manifest = z.infer<typeof manifestSchema>;

export function emptyManifest(): Manifest {
  return { version: 1, assets: [] };
}
