import { writeFile } from "node:fs/promises";
import { imageSize } from "image-size";
import {
  screenshotsOptionsSchema,
  type ResolvedScreenshotsOptions,
} from "@/generators/screenshots/options";
import { captureScreenshots } from "@/generators/screenshots/capture";
import { requireUrl } from "@/generators/require-url";
import { sha256Buffer } from "@/utils/hash";
import { slugify } from "@/utils/paths";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const SCREENSHOTS_ID = "screenshots";

function dimensions(buffer: Buffer): { width: number; height: number } {
  try {
    const size = imageSize(buffer);
    return { width: size.width ?? 0, height: size.height ?? 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}

async function run(
  ctx: PipelineContext,
  options: ResolvedScreenshotsOptions,
): Promise<{ assets: AssetRecord[] }> {
  const ext = options.format === "jpeg" ? "jpg" : "png";
  const url = requireUrl(ctx);
  ctx.logger.info(`capturing ${url}`);

  const shots = await captureScreenshots({
    browser: ctx.browser,
    url,
    options,
    logger: ctx.logger,
  });

  const records: AssetRecord[] = [];
  for (const shot of shots) {
    const fileName = `${slugify(ctx.target.name)}-${slugify(shot.key)}.${ext}`;
    const outPath = ctx.resolveOutPath(fileName);
    await writeFile(outPath, shot.buffer);

    const { width, height } = dimensions(shot.buffer);
    const record: AssetRecord = {
      id: `${ctx.target.name}-${shot.key}`,
      generator: SCREENSHOTS_ID,
      sourceUrl: url,
      file: ctx.toManifestPath(outPath),
      format: ext,
      width,
      height,
      bytes: shot.buffer.length,
      contentHash: sha256Buffer(shot.buffer),
      createdAt: new Date().toISOString(),
      toolVersion: ctx.toolVersion,
    };
    await ctx.writeAsset(record);
    records.push(record);
    ctx.logger.success(`${record.id} → ${record.file}`);
  }

  return { assets: records };
}

export const screenshotsGenerator: Generator<ResolvedScreenshotsOptions> = {
  id: SCREENSHOTS_ID,
  optionsSchema: screenshotsOptionsSchema,
  run,
};
