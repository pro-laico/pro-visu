import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { ensureDir } from "@/utils/fs";
import {
  emptyManifest,
  manifestSchema,
  type AssetRecord,
  type Manifest,
} from "@/manifest/schema";

function manifestPath(outDir: string): string {
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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Lock errors the tmp→rename swap can hit transiently on Windows (held handles, AV scans). */
const TRANSIENT_RENAME_CODES = new Set(["EPERM", "EACCES", "EBUSY"]);

/**
 * Atomically write the manifest (sorted by id for stable diffs).
 *
 * The tmp→rename swap can fail with EPERM/EACCES/EBUSY on Windows when another process holds a
 * brief handle on the target — the managed server serving `public/`, an editor, or antivirus
 * scanning the just-written file. Retry the rename a few times with backoff, then fall back to a
 * direct (non-atomic) overwrite, so a long generation run never dies on a flaky lock.
 */
export async function writeManifest(outDir: string, manifest: Manifest): Promise<void> {
  await ensureDir(outDir);
  const file = manifestPath(outDir);
  const tmp = `${file}.tmp`;
  const sorted: Manifest = {
    ...manifest,
    assets: [...manifest.assets].sort((a, b) => a.id.localeCompare(b.id)),
  };
  const contents = `${JSON.stringify(sorted, null, 2)}\n`;
  await writeFile(tmp, contents, "utf8");

  const maxAttempts = 5;
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(tmp, file);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (!code || !TRANSIENT_RENAME_CODES.has(code)) throw err;
      if (attempt < maxAttempts) {
        await sleep(attempt * 50); // 50,100,150,200ms backoff
        continue;
      }
      // The lock outlived our retries — overwrite in place (non-atomic) and clean up the tmp.
      await writeFile(file, contents, "utf8");
      await rm(tmp, { force: true });
      return;
    }
  }
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
