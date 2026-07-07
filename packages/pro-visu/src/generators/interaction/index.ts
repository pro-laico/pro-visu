import { stat } from "node:fs/promises";
import {
  interactionOptionsSchema,
  type ResolvedInteractionOptions,
} from "@/generators/interaction/options";
import { captureFocusWebm, captureInteractionWebm } from "@/generators/interaction/capture";
import { requireUrl } from "@/generators/require-url";
import { transcodeToMp4 } from "@/media/ffmpeg";
import { sha256File } from "@/utils/hash";
import { slugify } from "@/utils/paths";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const INTERACTION_ID = "interaction";

/**
 * A realtime recording of a scripted interaction (synthetic cursor driving the page) and/or an
 * element-focused clip cropped to one component. Always realtime — interactions and their
 * animations are inherently time-based — and always a single asset.
 */
async function run(
  ctx: PipelineContext,
  options: ResolvedInteractionOptions,
): Promise<{ assets: AssetRecord[] }> {
  const url = requireUrl(ctx);
  const preset = ctx.quality === "draft" ? "ultrafast" : "medium";
  const fileName = options.output.fileName ?? `${slugify(ctx.target.name)}.mp4`;
  const outPath = ctx.resolveOutPath(fileName);

  ctx.logger.info(
    options.focus
      ? `recording ${url} (focus: ${options.focus.selector})`
      : `recording ${url} (interaction, ${options.actions.length} action(s))`,
  );
  const args = {
    browser: ctx.browser,
    capture: ctx.capture,
    url,
    options,
    tmpDir: ctx.tmpDir,
    logger: ctx.logger,
  };
  let cropBox: { x: number; y: number; width: number; height: number } | undefined;
  let result: { webmPath: string; leadSeconds: number; durationSeconds: number };
  if (options.focus) {
    const focusResult = await captureFocusWebm(args);
    cropBox = focusResult.cropBox;
    result = focusResult;
  } else {
    result = await captureInteractionWebm(args);
  }
  const width = cropBox?.width ?? options.output.width;
  const height = cropBox?.height ?? options.output.height;

  ctx.logger.debug(`transcoding to mp4${cropBox ? " (cropped)" : ""}`);
  await transcodeToMp4({
    inputPath: result.webmPath,
    outputPath: outPath,
    fps: options.output.fps,
    width,
    height,
    crf: options.output.crf,
    preset,
    // Drop the navigation + warm-up lead, then clamp to the intended length.
    startOffsetSeconds: result.leadSeconds,
    durationSeconds: result.durationSeconds,
    crop: cropBox,
    logger: ctx.logger,
    signal: ctx.signal,
  });

  const [stats, contentHash] = await Promise.all([stat(outPath), sha256File(outPath)]);
  const record: AssetRecord = {
    id: ctx.target.name,
    generator: INTERACTION_ID,
    sourceUrl: url,
    file: ctx.toManifestPath(outPath),
    format: "mp4",
    width,
    height,
    durationMs: Math.round(result.durationSeconds * 1000),
    bytes: stats.size,
    contentHash,
    createdAt: new Date().toISOString(),
    toolVersion: ctx.toolVersion,
  };
  await ctx.writeAsset(record);
  ctx.logger.success(`${ctx.target.name} → ${record.file}`);
  return { assets: [record] };
}

export const interactionGenerator: Generator<ResolvedInteractionOptions> = {
  id: INTERACTION_ID,
  requiresUrl: true,
  optionsSchema: interactionOptionsSchema,
  run,
};
