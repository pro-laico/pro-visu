import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { ensureDir } from "@/utils/fs";
import {
  emptyManifest,
  manifestSchema,
  type AssetRecord,
  type Manifest,
} from "@/manifest/schema";

export function manifestPath(outDir: string): string {
  return path.join(outDir, "manifest.json");
}

/** Read + validate the manifest, returning an empty one if none exists. */
export async function readManifest(outDir: string): Promise<Manifest> {
  const file = manifestPath(outDir);
  if (!existsSync(file)) return emptyManifest();

  const text = await readFile(file, "utf8");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Corrupt manifest (invalid JSON): ${file}`);
  }
  const parsed = manifestSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Corrupt manifest (schema mismatch): ${file}`);
  }
  return parsed.data;
}

/** Atomically write the manifest (sorted by id for stable diffs). */
export async function writeManifest(outDir: string, manifest: Manifest): Promise<void> {
  await ensureDir(outDir);
  const file = manifestPath(outDir);
  const tmp = `${file}.tmp`;
  const sorted: Manifest = {
    ...manifest,
    assets: [...manifest.assets].sort((a, b) => a.id.localeCompare(b.id)),
  };
  await writeFile(tmp, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

/**
 * In-memory manifest with serialized, idempotent (by id) upserts flushed to disk.
 * Serializing through a promise chain keeps concurrent generators from racing on the file.
 */
export class ManifestStore {
  private chain: Promise<void> = Promise.resolve();

  private constructor(
    private readonly outDir: string,
    private readonly manifest: Manifest,
  ) {}

  static async load(outDir: string): Promise<ManifestStore> {
    return new ManifestStore(outDir, await readManifest(outDir));
  }

  /** Replace an existing record with the same id, or append a new one; then flush. */
  upsert(record: AssetRecord): Promise<void> {
    this.chain = this.chain.then(async () => {
      const index = this.manifest.assets.findIndex((a) => a.id === record.id);
      if (index >= 0) this.manifest.assets[index] = record;
      else this.manifest.assets.push(record);
      await writeManifest(this.outDir, this.manifest);
    });
    return this.chain;
  }

  get records(): readonly AssetRecord[] {
    return this.manifest.assets;
  }

  /** Look up the existing record for an asset id (for cache checks). */
  find(id: string): AssetRecord | undefined {
    return this.manifest.assets.find((a) => a.id === id);
  }
}
