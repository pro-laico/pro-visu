import path from "node:path";
import { copyFile, stat } from "node:fs/promises";
import {
  aspectTarget,
  buildAspectArgs,
  buildGifArgs,
  buildPosterArgs,
  buildStillSegmentArgs,
  buildWebpArgs,
  concatMp4,
  probeVideoDurationMs,
  runFfmpeg,
} from "@/media/ffmpeg";
import {
  renderCard,
  DEFAULT_CARD_DURATION_MS,
  DEFAULT_CARD_FADE_MS,
  type CardSpec,
} from "@/generators/scroll-reel/cards";
import { ensureDir } from "@/utils/fs";
import { sha256File } from "@/utils/hash";
import { slugify } from "@/utils/paths";
import type { ResolvedScrollReelOptions } from "@/generators/scroll-reel/options";
import type { PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export interface OutputJob {
  ctx: PipelineContext;
  generatorId: string;
  /** The captured mp4 (viewport-sized) in tmp. */
  sourceMp4: string;
  /** Filename base (no extension), including any variant suffix. */
  fileBase: string;
  /** Manifest asset id base, including any variant suffix. */
  assetId: string;
  sourceUrl: string;
  /** Capture dimensions (before any aspect reframe). */
  width: number;
  height: number;
  deviceScaleFactor: number;
  durationMs: number;
  options: ResolvedScrollReelOptions;
  preset: string;
}

// mp4 first so it stays the primary output (used when another asset references this one as an input).
const FORMAT_ORDER = ["mp4", "gif", "webp", "poster"] as const;

/**
 * From a captured mp4, optionally reframe to a target aspect (shared by every output), then emit the
 * requested formats — mp4 / gif / webp / poster — each as its own manifest asset (id suffixed by format,
 * except mp4 which keeps the base id). The aspect reframe and alternate encodes are pure ffmpeg argv
 * builders in `@/media/ffmpeg`; this just orchestrates them and records the results.
 */
export async function produceOutputs(job: OutputJob): Promise<AssetRecord[]> {
  const { ctx, options } = job;
  const logger = ctx.logger;

  // 1. Aspect reframe (once, shared by every output) — or use the capture as-is.
  let videoMp4 = job.sourceMp4;
  let outW = job.width;
  let outH = job.height;
  if (options.aspect) {
    const target = aspectTarget(options.aspect);
    outW = target.width;
    outH = target.height;
    const reframed = path.join(ctx.tmpDir, `${slugify(job.assetId)}-aspect.mp4`);
    await runFfmpeg(
      buildAspectArgs({
        inputPath: job.sourceMp4,
        outputPath: reframed,
        width: outW,
        height: outH,
        fit: options.fit,
        padColor: options.padColor,
        fps: options.fps,
        crf: options.crf,
        preset: job.preset,
      }),
      logger,
    );
    videoMp4 = reframed;
  }

  // The poster always comes from the content clip (never an intro card's fade-from-black).
  const posterSource = videoMp4;

  // 2. Intro / outro cards: render at the output size and concatenate around the clip.
  let extraMs = 0;
  if (options.intro || options.outro) {
    const makeCard = async (spec: CardSpec, tag: string): Promise<string> => {
      const ms = spec.durationMs ?? DEFAULT_CARD_DURATION_MS;
      const fade = (spec.fadeMs ?? DEFAULT_CARD_FADE_MS) / 1000;
      const png = path.join(ctx.tmpDir, `${slugify(job.assetId)}-${tag}.png`);
      await renderCard(ctx.browser, {
        spec,
        width: outW,
        height: outH,
        scale: job.deviceScaleFactor,
        outPath: png,
      });
      const seg = path.join(ctx.tmpDir, `${slugify(job.assetId)}-${tag}.mp4`);
      await runFfmpeg(
        buildStillSegmentArgs({
          pngPath: png,
          outPath: seg,
          seconds: ms / 1000,
          fps: options.fps,
          width: outW,
          height: outH,
          fadeInSec: fade,
          fadeOutSec: fade,
          crf: options.crf,
          preset: job.preset,
        }),
        logger,
      );
      extraMs += ms;
      return seg;
    };
    const segs: string[] = [];
    if (options.intro) segs.push(await makeCard(options.intro, "intro"));
    segs.push(videoMp4);
    if (options.outro) segs.push(await makeCard(options.outro, "outro"));
    if (segs.length > 1) {
      const stitched = path.join(ctx.tmpDir, `${slugify(job.assetId)}-carded.mp4`);
      await concatMp4(segs, stitched, logger);
      videoMp4 = stitched;
    }
  }
  // Probe the real container duration (concat/mux can drift a little from the computed sum).
  const videoMs = (await probeVideoDurationMs(videoMp4)) ?? job.durationMs + extraMs;

  const gifFps = options.gifFps ?? Math.min(options.fps, 15);
  const want = new Set(options.outputs);
  const records: AssetRecord[] = [];

  for (const fmt of FORMAT_ORDER) {
    if (!want.has(fmt)) continue;
    const ext = fmt === "poster" ? "png" : fmt;
    const outPath = ctx.resolveOutPath(`${job.fileBase}.${ext}`);
    await ensureDir(path.dirname(outPath));

    if (fmt === "mp4") {
      await copyFile(videoMp4, outPath);
    } else if (fmt === "gif") {
      await runFfmpeg(buildGifArgs({ inputPath: videoMp4, outputPath: outPath, fps: gifFps }), logger);
    } else if (fmt === "webp") {
      await runFfmpeg(
        buildWebpArgs({ inputPath: videoMp4, outputPath: outPath, fps: gifFps, quality: 75 }),
        logger,
      );
    } else {
      await runFfmpeg(
        buildPosterArgs({ inputPath: posterSource, outputPath: outPath, atSeconds: 0 }),
        logger,
      );
    }

    const [stats, contentHash] = await Promise.all([stat(outPath), sha256File(outPath)]);
    const id = fmt === "mp4" ? job.assetId : `${job.assetId}-${fmt}`;
    records.push({
      id,
      generator: job.generatorId,
      sourceUrl: job.sourceUrl,
      file: ctx.toManifestPath(outPath),
      format: ext,
      width: outW,
      height: outH,
      durationMs: fmt === "poster" ? undefined : videoMs,
      bytes: stats.size,
      contentHash,
      createdAt: new Date().toISOString(),
      toolVersion: ctx.toolVersion,
    });
    logger.success(`${id} → ${ctx.toManifestPath(outPath)}`);
  }

  return records;
}
