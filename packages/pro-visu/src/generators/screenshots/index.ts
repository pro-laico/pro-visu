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

  // Each shot is written (and its record built) the moment it's captured, so the buffer is freed
  // immediately instead of every viewport's shots piling up in memory until the end.
  const persist = async (key: string, buffer: Buffer): Promise<AssetRecord> => {
    const fileName = `${slugify(ctx.target.name)}-${slugify(key)}.${ext}`;
    const outPath = ctx.resolveOutPath(fileName);
    await writeFile(outPath, buffer);

    const { width, height } = dimensions(buffer);
    if (width === 0 || height === 0) {
      ctx.logger.warn(`could not read dimensions for ${fileName} (recording 0×0)`);
    } else {
      ctx.logger.debug(`${fileName}: ${width}×${height}`);
      // Chromium caps screenshots near ~32767px; a very tall fullPage shot may be clipped/huge.
      if (width > 16000 || height > 16000) {
        ctx.logger.warn(
          `${fileName} is very large (${width}×${height}); a fullPage shot at deviceScaleFactor ${options.deviceScaleFactor} may be clipped or slow — consider a lower scale.`,
        );
      }
    }
    return {
      id: `${ctx.target.name}-${key}`,
      generator: SCREENSHOTS_ID,
      sourceUrl: url,
      file: ctx.toManifestPath(outPath),
      format: ext,
      width,
      height,
      bytes: buffer.length,
      contentHash: sha256Buffer(buffer),
      createdAt: new Date().toISOString(),
      toolVersion: ctx.toolVersion,
    };
  };

  const records = await captureScreenshots({
    browser: ctx.browser,
    url,
    options,
    logger: ctx.logger,
    capture: ctx.capture,
    persist,
  });

  // Manifest writes + success lines stay in stable (viewport-order) sequence after the fact.
  for (const record of records) {
    await ctx.writeAsset(record);
    ctx.logger.success(`${record.id} → ${record.file}`);
  }

  return { assets: records };
}

export const screenshotsGenerator: Generator<ResolvedScreenshotsOptions> = {
  id: SCREENSHOTS_ID,
  requiresUrl: true,
  optionsSchema: screenshotsOptionsSchema,
  run,
};
