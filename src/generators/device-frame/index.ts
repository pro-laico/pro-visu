import path from "node:path";
import { copyFile, rename, stat } from "node:fs/promises";
import {
  deviceFrameOptionsSchema,
  type ResolvedDeviceFrameOptions,
} from "@/generators/device-frame/options";
import { renderChrome } from "@/generators/device-frame/chrome";
import { buildDeviceFrameArgs } from "@/generators/device-frame/composite";
import { captureScrollWebm } from "@/generators/scroll-reel/capture";
import { probeVideoDimensions, runFfmpeg, transcodeToMp4 } from "@/media/ffmpeg";
import { ensureDir } from "@/utils/fs";
import { sha256File } from "@/utils/hash";
import { slugify } from "@/utils/paths";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const DEVICE_FRAME_ID = "device-frame";

async function run(
  ctx: PipelineContext,
  options: ResolvedDeviceFrameOptions,
): Promise<{ assets: AssetRecord[] }> {
  const fileName = options.fileName ?? `${slugify(ctx.target.name)}.mp4`;
  const outPath = ctx.resolveOutPath(fileName);

  // 1. Record the site (same capture path as scroll-reel), then transcode to mp4.
  ctx.logger.info(`recording ${ctx.target.url}`);
  const { webmPath } = await captureScrollWebm({
    browser: ctx.browser,
    url: ctx.target.url,
    options,
    tmpDir: ctx.tmpDir,
    logger: ctx.logger,
  });
  const captureMp4 = path.join(ctx.tmpDir, `${slugify(ctx.target.name)}-capture.mp4`);
  await transcodeToMp4({
    inputPath: webmPath,
    outputPath: captureMp4,
    fps: options.fps,
    width: options.width,
    height: options.height,
    crf: options.crf,
    logger: ctx.logger,
  });

  // 2. Paint the (static) browser-window chrome once via the Playwright browser, then
  //    composite the capture into it with a single ffmpeg pass — no per-frame rendering.
  ctx.logger.debug("rendering window chrome");
  const chrome = await renderChrome({
    browser: ctx.browser,
    outDir: ctx.tmpDir,
    videoWidth: options.width,
    videoHeight: options.height,
    frameWidth: options.frameWidth,
    background: options.background,
    scale: options.deviceScaleFactor,
    logger: ctx.logger,
  });

  const durationSeconds =
    (options.startDelayMs + options.duration + options.endDwellMs) / 1000;

  ctx.logger.debug("compositing device frame (ffmpeg)");
  await ensureDir(path.dirname(outPath));
  const composedTmp = path.join(ctx.tmpDir, `${slugify(ctx.target.name)}-framed.mp4`);
  await runFfmpeg(
    buildDeviceFrameArgs({
      videoPath: captureMp4,
      framePng: chrome.framePng,
      maskPng: chrome.maskPng,
      outPath: composedTmp,
      frameWidth: chrome.frameWidthPx,
      frameHeight: chrome.frameHeightPx,
      viewport: chrome.viewport,
      background: options.background,
      fps: options.fps,
      crf: options.crf,
      durationSeconds,
    }),
    ctx.logger,
  );

  // 3. Move into the showcase output dir.
  try {
    await rename(composedTmp, outPath);
  } catch {
    await copyFile(composedTmp, outPath); // cross-device fallback
  }

  const [dims, stats, contentHash] = await Promise.all([
    probeVideoDimensions(outPath),
    stat(outPath),
    sha256File(outPath),
  ]);
  const record: AssetRecord = {
    id: ctx.target.name,
    generator: DEVICE_FRAME_ID,
    sourceUrl: ctx.target.url,
    file: ctx.toManifestPath(outPath),
    format: "mp4",
    width: dims?.width ?? chrome.frameWidthPx,
    height: dims?.height ?? chrome.frameHeightPx,
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

export const deviceFrameGenerator: Generator<ResolvedDeviceFrameOptions> = {
  id: DEVICE_FRAME_ID,
  optionsSchema: deviceFrameOptionsSchema,
  run,
};
