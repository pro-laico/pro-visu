import path from "node:path";
import {
  scrollReelOptionsSchema,
  type ResolvedScrollReelOptions,
} from "@/generators/scroll-reel/options";
import { captureScrollFrames } from "@/generators/scroll-reel/capture-frames";
import { scrollTimelineTotalMs } from "@/generators/scroll-reel/timeline";
import { buildVariants } from "@/generators/scroll-reel/variants";
import { produceOutputs } from "@/generators/scroll-reel/outputs";
import { requireUrl } from "@/generators/require-url";
import { autoWorkers } from "@/recorder/frame-capture";
import { slugify } from "@/utils/paths";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const SCROLL_REEL_ID = "scroll-reel";

/**
 * A frame-stepped recording of a page scrolling — a virtual clock per frame, so output is
 * frame-accurate and byte-identical run-to-run. The viewport × color-scheme matrix expands into
 * variants (each its own asset); each capture is then reframed / re-encoded into the requested
 * output formats. For a realtime recording of the live page, use the `interaction` generator.
 */
async function run(
  ctx: PipelineContext,
  options: ResolvedScrollReelOptions,
): Promise<{ assets: AssetRecord[] }> {
  const url = requireUrl(ctx);
  const draft = ctx.quality === "draft";
  const preset = draft ? "ultrafast" : "medium";

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
