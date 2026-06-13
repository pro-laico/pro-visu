import { stat } from "node:fs/promises";
import {
  scrollReelOptionsSchema,
  type ResolvedScrollReelOptions,
} from "@/generators/scroll-reel/options";
import { captureScrollWebm } from "@/generators/scroll-reel/capture";
import { requireUrl } from "@/generators/require-url";
import { transcodeToMp4 } from "@/media/ffmpeg";
import { sha256File } from "@/utils/hash";
import { slugify } from "@/utils/paths";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const SCROLL_REEL_ID = "scroll-reel";

async function run(
  ctx: PipelineContext,
  options: ResolvedScrollReelOptions,
): Promise<{ assets: AssetRecord[] }> {
  const fileName = options.fileName ?? `${slugify(ctx.target.name)}.mp4`;
  const outPath = ctx.resolveOutPath(fileName);
  const url = requireUrl(ctx);

  ctx.logger.info(`recording ${url}`);
  const { webmPath, leadSeconds } = await captureScrollWebm({
    browser: ctx.browser,
    url,
    options,
    tmpDir: ctx.tmpDir,
    logger: ctx.logger,
  });

  ctx.logger.debug("transcoding to mp4");
  const durationSeconds = (options.startDelayMs + options.duration + options.endDwellMs) / 1000;
  await transcodeToMp4({
    inputPath: webmPath,
    outputPath: outPath,
    fps: options.fps,
    width: options.width,
    height: options.height,
    crf: options.crf,
    preset: ctx.quality === "draft" ? "ultrafast" : "medium",
    // Drop the navigation + warm-up lead, then clamp to the intended length so the clip opens on
    // the start-of-scroll frame and is exactly startDelay + duration + endDwell long.
    startOffsetSeconds: leadSeconds,
    durationSeconds,
    logger: ctx.logger,
  });

  const [stats, contentHash] = await Promise.all([stat(outPath), sha256File(outPath)]);
  const record: AssetRecord = {
    id: ctx.target.name,
    generator: SCROLL_REEL_ID,
    sourceUrl: url,
    file: ctx.toManifestPath(outPath),
    format: "mp4",
    width: options.width,
    height: options.height,
    durationMs: options.startDelayMs + options.duration + options.endDwellMs,
    bytes: stats.size,
    contentHash,
    createdAt: new Date().toISOString(),
    toolVersion: ctx.toolVersion,
  };
  await ctx.writeAsset(record);
  ctx.logger.success(`${ctx.target.name} → ${record.file}`);

  return { assets: [record] };
}

export const scrollReelGenerator: Generator<ResolvedScrollReelOptions> = {
  id: SCROLL_REEL_ID,
  optionsSchema: scrollReelOptionsSchema,
  run,
};
