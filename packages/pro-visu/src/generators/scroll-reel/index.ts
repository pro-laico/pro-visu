import path from "node:path";
import { stat } from "node:fs/promises";
import {
  scrollReelOptionsSchema,
  type ResolvedScrollReelOptions,
} from "@/generators/scroll-reel/options";
import { captureScrollWebm } from "@/generators/scroll-reel/capture";
import { captureScrollFrames } from "@/generators/scroll-reel/capture-frames";
import { scrollTimelineTotalMs } from "@/generators/scroll-reel/timeline";
import { buildVariants } from "@/generators/scroll-reel/variants";
import { produceOutputs } from "@/generators/scroll-reel/outputs";
import { requireUrl } from "@/generators/require-url";
import { concatMp4, transcodeToMp4 } from "@/media/ffmpeg";
import { autoWorkers } from "@/recorder/frame-capture";
import { sha256File } from "@/utils/hash";
import { slugify } from "@/utils/paths";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const SCROLL_REEL_ID = "scroll-reel";

async function run(
  ctx: PipelineContext,
  options: ResolvedScrollReelOptions,
): Promise<{ assets: AssetRecord[] }> {
  const url = requireUrl(ctx);
  const draft = ctx.quality === "draft";
  const preset = draft ? "ultrafast" : "medium";

  // Multi-page tour: capture each route as a frame-stepped segment, then concatenate into one reel.
  if (options.routes && options.routes.length > 0) {
    if (options.viewports?.length || options.colorScheme === "both") {
      ctx.logger.warn('viewports / colorScheme:"both" are not expanded for route tours');
    }
    const scheme =
      options.colorScheme === "dark" ? "dark" : options.colorScheme === "light" ? "light" : undefined;
    const workers = options.workers ?? autoWorkers();
    const segments: string[] = [];
    const routeCount = options.routes.length; // captured: narrowing doesn't persist into the progress closure
    let totalMs = 0;
    for (let i = 0; i < options.routes.length; i++) {
      const r = options.routes[i]!;
      const routeUrl = typeof r === "string" ? r : r.url;
      const routeOpts =
        typeof r === "string"
          ? { ...options, choreography: undefined, autoSections: undefined }
          : {
              ...options,
              choreography: r.choreography,
              autoSections: r.autoSections,
              durationMs: r.durationMs ?? options.durationMs,
            };
      const segPath = path.join(ctx.tmpDir, `${slugify(ctx.target.name)}-route-${i}.mp4`);
      ctx.logger.info(
        `recording route ${i + 1}/${options.routes.length}: ${routeUrl} (frame-stepped)`,
      );
      await captureScrollFrames({
        browser: ctx.browser,
        capture: ctx.capture,
        url: routeUrl,
        options: routeOpts,
        outPath: segPath,
        preset,
        workers,
        frameFormat: draft ? "jpeg" : options.frameFormat,
        jpegQuality: draft ? 70 : 90,
        settlePerFrame: options.settlePerFrame ?? !draft,
        settleMaxMs: options.settleMaxMs,
        colorScheme: scheme,
        tmpDir: ctx.tmpDir,
        logger: ctx.logger,
        // Weight each route's capture into one overall 0–1 across the whole tour.
        onProgress: ctx.progress ? (f) => ctx.progress?.((i + f) / routeCount) : undefined,
        signal: ctx.signal,
      });
      segments.push(segPath);
      totalMs += scrollTimelineTotalMs(routeOpts);
    }
    const tourMp4 = path.join(ctx.tmpDir, `${slugify(ctx.target.name)}-tour.mp4`);
    await concatMp4(segments, tourMp4, ctx.logger, ctx.signal);
    const baseName = (options.fileName ?? `${slugify(ctx.target.name)}.mp4`).replace(/\.mp4$/i, "");
    const recs = await produceOutputs({
      ctx,
      generatorId: SCROLL_REEL_ID,
      sourceMp4: tourMp4,
      fileBase: baseName,
      assetId: ctx.target.name,
      sourceUrl: url,
      width: options.width,
      height: options.height,
      durationMs: totalMs,
      options,
      preset,
    });
    for (const r of recs) await ctx.writeAsset(r);
    return { assets: recs };
  }

  // Realtime: a single capture. Choreography / auto-sections / variants are frames-only.
  if (options.capture !== "frames") {
    if (options.choreography?.length || options.autoSections) {
      ctx.logger.warn('choreography/autoSections are ignored for capture:"realtime"');
    }
    if (options.viewports?.length || options.colorScheme === "both") {
      ctx.logger.warn('viewports / colorScheme:"both" are ignored for capture:"realtime"');
    }
    const fileName = options.fileName ?? `${slugify(ctx.target.name)}.mp4`;
    const outPath = ctx.resolveOutPath(fileName);
    const durationSeconds = (options.startDelayMs + options.durationMs + options.endDwellMs) / 1000;
    ctx.logger.info(`recording ${url} (realtime)`);
    const { webmPath, leadSeconds } = await captureScrollWebm({
      browser: ctx.browser,
      capture: ctx.capture,
      url,
      options,
      tmpDir: ctx.tmpDir,
      logger: ctx.logger,
    });
    ctx.logger.debug("transcoding to mp4");
    await transcodeToMp4({
      inputPath: webmPath,
      outputPath: outPath,
      fps: options.fps,
      width: options.width,
      height: options.height,
      crf: options.crf,
      preset,
      // Drop the navigation + warm-up lead, then clamp to the intended length.
      startOffsetSeconds: leadSeconds,
      durationSeconds,
      logger: ctx.logger,
      signal: ctx.signal,
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
      durationMs: options.startDelayMs + options.durationMs + options.endDwellMs,
      bytes: stats.size,
      contentHash,
      createdAt: new Date().toISOString(),
      toolVersion: ctx.toolVersion,
    };
    await ctx.writeAsset(record);
    ctx.logger.success(`${ctx.target.name} → ${record.file}`);
    return { assets: [record] };
  }

  // Frames: expand the viewport × color-scheme matrix; each variant is its own asset.
  const variants = buildVariants({
    width: options.width,
    height: options.height,
    deviceScaleFactor: options.deviceScaleFactor,
    viewports: options.viewports,
    colorScheme: options.colorScheme,
  });
  const baseName = (options.fileName ?? `${slugify(ctx.target.name)}.mp4`).replace(/\.mp4$/i, "");
  const workers = options.workers ?? autoWorkers();
  const assets: AssetRecord[] = [];

  for (const v of variants) {
    const fileBase = v.suffix ? `${baseName}-${v.suffix}` : baseName;
    const assetId = v.suffix ? `${ctx.target.name}-${v.suffix}` : ctx.target.name;
    const captureMp4 = path.join(ctx.tmpDir, `${slugify(assetId)}-capture.mp4`);
    const vopts = {
      ...options,
      width: v.width,
      height: v.height,
      deviceScaleFactor: v.deviceScaleFactor,
    };
    const label = v.suffix ? ` [${v.suffix}]` : "";
    ctx.logger.info(`recording ${url}${label} (frame-stepped, ${workers} worker(s))`);
    await captureScrollFrames({
      browser: ctx.browser,
      capture: ctx.capture,
      url,
      options: vopts,
      outPath: captureMp4,
      preset,
      workers,
      // Draft always uses fast jpeg intermediates; final uses the configured format (png = lossless).
      frameFormat: draft ? "jpeg" : options.frameFormat,
      jpegQuality: draft ? 70 : 90,
      // Per-frame settling defaults on, off in draft for speed (override with the explicit option).
      settlePerFrame: options.settlePerFrame ?? !draft,
      settleMaxMs: options.settleMaxMs,
      colorScheme: v.colorScheme,
      tmpDir: ctx.tmpDir,
      logger: ctx.logger,
      onProgress: ctx.progress,
      signal: ctx.signal,
    });
    // Reframe to the requested aspect (if any) and emit each output format as its own asset.
    const recs = await produceOutputs({
      ctx,
      generatorId: SCROLL_REEL_ID,
      sourceMp4: captureMp4,
      fileBase,
      assetId,
      sourceUrl: url,
      width: v.width,
      height: v.height,
      durationMs: scrollTimelineTotalMs(vopts),
      options,
      preset,
    });
    for (const r of recs) await ctx.writeAsset(r);
    assets.push(...recs);
  }

  return { assets };
}

export const scrollReelGenerator: Generator<ResolvedScrollReelOptions> = {
  id: SCROLL_REEL_ID,
  requiresUrl: true,
  optionsSchema: scrollReelOptionsSchema,
  run,
};
