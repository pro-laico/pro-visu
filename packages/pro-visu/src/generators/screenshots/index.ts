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
    capture: ctx.capture,
  });

  const records: AssetRecord[] = [];
  for (const shot of shots) {
    const fileName = `${slugify(ctx.target.name)}-${slugify(shot.key)}.${ext}`;
    const outPath = ctx.resolveOutPath(fileName);
    await writeFile(outPath, shot.buffer);

    const { width, height } = dimensions(shot.buffer);
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
  requiresUrl: true,
  optionsSchema: screenshotsOptionsSchema,
  run,
};
