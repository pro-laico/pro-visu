import path from "node:path";
import { copyFile, rename, stat } from "node:fs/promises";
import {
  deviceFrameOptionsSchema,
  type ResolvedDeviceFrameOptions,
} from "@/generators/device-frame/options";
import { renderChrome } from "@/generators/device-frame/chrome";
import { buildDeviceFrameArgs } from "@/generators/device-frame/composite";
import { captureScrollWebm } from "@/generators/scroll-reel/capture";
import { captureScrollFrames } from "@/generators/scroll-reel/capture-frames";
import { scrollTimelineTotalMs } from "@/generators/scroll-reel/timeline";
import { requireUrl } from "@/generators/require-url";
import { probeVideoDimensions, runFfmpeg, transcodeToMp4 } from "@/media/ffmpeg";
import { autoWorkers } from "@/media/frame-capture";
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
  const url = requireUrl(ctx);

  // 1. Record the site (same capture path as scroll-reel) into an mp4 to composite.
  const draft = ctx.quality === "draft";
  const preset = draft ? "ultrafast" : "medium";
  // Clip length: choreography-aware for frames; the classic sweep length for realtime.
  const durationMs =
    options.capture === "frames"
      ? scrollTimelineTotalMs(options)
      : options.startDelayMs + options.duration + options.endDwellMs;
  const captureSeconds = durationMs / 1000;
  const captureMp4 = path.join(ctx.tmpDir, `${slugify(ctx.target.name)}-capture.mp4`);
  // device-frame captures a single variant; honor a single color scheme but don't expand a matrix.
  const dfScheme =
    options.colorScheme === "dark" ? "dark" : options.colorScheme === "light" ? "light" : undefined;
  if (options.viewports?.length || options.colorScheme === "both") {
    ctx.logger.warn("device-frame does not expand viewports / colorScheme:\"both\" — capturing one variant");
  }
  if (options.aspect || options.outputs.length !== 1 || options.outputs[0] !== "mp4") {
    ctx.logger.warn("device-frame ignores aspect / outputs — emitting a single mp4");
  }

  if (options.capture === "frames") {
    const workers = options.workers ?? autoWorkers();
    ctx.logger.info(`recording ${url} (frame-stepped, ${workers} worker(s))`);
    await captureScrollFrames({
      browser: ctx.browser,
      url,
      options,
      outPath: captureMp4,
      preset,
      workers,
      // Draft always uses fast jpeg intermediates; final uses the configured format (png = lossless).
      frameFormat: draft ? "jpeg" : options.frameFormat,
      jpegQuality: draft ? 70 : 90,
      // Per-frame settling defaults on, off in draft for speed (override with the explicit option).
      settlePerFrame: options.settlePerFrame ?? !draft,
      settleMaxMs: options.settleMaxMs,
      colorScheme: dfScheme,
      tmpDir: ctx.tmpDir,
      logger: ctx.logger,
    });
  } else {
    if (options.choreography?.length || options.autoSections) {
      ctx.logger.warn('choreography/autoSections are ignored for capture:"realtime"');
    }
    ctx.logger.info(`recording ${url} (realtime)`);
    const { webmPath, leadSeconds } = await captureScrollWebm({
      browser: ctx.browser,
      url,
      options,
      tmpDir: ctx.tmpDir,
      logger: ctx.logger,
    });
    await transcodeToMp4({
      inputPath: webmPath,
      outputPath: captureMp4,
      fps: options.fps,
      width: options.width,
      height: options.height,
      crf: options.crf,
      preset,
      // Trim the navigation + warm-up lead and clamp to the intended length, so the framed clip opens
      // on the scroll and the backdrop's `d` (below) stays aligned with the content.
      startOffsetSeconds: leadSeconds,
      durationSeconds: captureSeconds,
      logger: ctx.logger,
    });
  }

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
      durationSeconds: captureSeconds,
      preset,
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
    sourceUrl: url,
    file: ctx.toManifestPath(outPath),
    format: "mp4",
    width: dims?.width ?? chrome.frameWidthPx,
    height: dims?.height ?? chrome.frameHeightPx,
    durationMs,
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
