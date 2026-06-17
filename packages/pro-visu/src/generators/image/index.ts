import path from "node:path";
import { existsSync } from "node:fs";
import { copyFile, readFile, stat } from "node:fs/promises";
import { imageSize } from "image-size";
import { imageOptionsSchema, type ResolvedImageOptions } from "@/generators/image/options";
import { ensureDir } from "@/utils/fs";
import { sha256File } from "@/utils/hash";
import { slugify } from "@/utils/paths";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const IMAGE_ID = "image";

/** File extension → manifest `format` label. */
const EXT_FORMAT: Record<string, string> = {
  ".jpg": "jpg",
  ".jpeg": "jpg",
  ".png": "png",
  ".webp": "webp",
  ".avif": "avif",
  ".gif": "gif",
};

/**
 * Copy an existing image into the output dir and record it — a passthrough so real, full-resolution
 * assets (photos, exported graphics) can be used directly as scene inputs (e.g. crisp media-wall
 * tiles) instead of re-capturing them at a lower resolution.
 */
async function run(ctx: PipelineContext, o: ResolvedImageOptions): Promise<{ assets: AssetRecord[] }> {
  const abs = path.isAbsolute(o.src) ? o.src : path.resolve(process.cwd(), o.src);
  if (!existsSync(abs)) throw new Error(`image src not found: ${o.src} (resolved ${abs})`);

  const ext = path.extname(abs).toLowerCase();
  const format = EXT_FORMAT[ext] ?? ext.replace(".", "") ?? "png";
  const fileName = o.fileName ?? `${slugify(ctx.target.name)}${ext || ".png"}`;
  const outPath = ctx.resolveOutPath(fileName);

  await ensureDir(path.dirname(outPath));
  await copyFile(abs, outPath);

  const [buf, stats, contentHash] = await Promise.all([
    readFile(outPath),
    stat(outPath),
    sha256File(outPath),
  ]);
  let width = 0;
  let height = 0;
  try {
    const d = imageSize(buf);
    width = d.width ?? 0;
    height = d.height ?? 0;
  } catch {
    ctx.logger.warn(`could not read dimensions for ${fileName}`);
  }

  const record: AssetRecord = {
    id: ctx.target.name,
    generator: IMAGE_ID,
    sourceUrl: `image:${path.basename(abs)}`,
    file: ctx.toManifestPath(outPath),
    format,
    width,
    height,
    bytes: stats.size,
    contentHash,
    createdAt: new Date().toISOString(),
    toolVersion: ctx.toolVersion,
  };
  await ctx.writeAsset(record);
  ctx.logger.success(`${ctx.target.name} → ${record.file}`);
  return { assets: [record] };
}

export const imageGenerator: Generator<ResolvedImageOptions> = {
  id: IMAGE_ID,
  optionsSchema: imageOptionsSchema,
  // The source file's content shapes the output — hash it into the cache key (and fail early if missing).
  fileDependencies: (o) => [o.src],
  run,
};
