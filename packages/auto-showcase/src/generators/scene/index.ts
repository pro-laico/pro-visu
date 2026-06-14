import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile, rename, stat } from "node:fs/promises";
import {
  sceneOptionsSchema,
  type ResolvedSceneOptions,
} from "@/generators/scene/options";
import { SCENE_OPTION_SCHEMAS } from "@/generators/scene/scene-options";
import { startSceneServer } from "@/scene/serve";
import { recordSceneRealtime } from "@/scene/capture-realtime";
import { captureSceneFrames } from "@/scene/capture-frames";
import { autoWorkers } from "@/media/frame-capture";
import { probeVideoDimensions, transcodeToMp4 } from "@/media/ffmpeg";
import { ensureDir } from "@/utils/fs";
import { sha256File } from "@/utils/hash";
import { slugify } from "@/utils/paths";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const SCENE_ID = "scene";

/** The built scene app shipped alongside the CLI bundle (dist/scene-app). */
function sceneAppDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url)); // dist/cli
  return path.resolve(here, "..", "scene-app");
}

/**
 * Render a scene to an mp4 and record it. Shared by the `scene` generator and friendly
 * wrappers (e.g. `specimen`), which pass their own `generatorId` for the manifest.
 */
export async function renderScene(
  ctx: PipelineContext,
  options: ResolvedSceneOptions,
  generatorId: string = SCENE_ID,
): Promise<{ assets: AssetRecord[] }> {
  // Validate the per-scene knobs against the selected scene's schema: a typo'd key or an unknown
  // scene id fails here with a named error instead of capturing a blank "Unknown scene" page.
  const sceneSchema = SCENE_OPTION_SCHEMAS[options.scene as keyof typeof SCENE_OPTION_SCHEMAS];
  if (!sceneSchema) {
    throw new Error(
      `Unknown scene "${options.scene}". Available: ${Object.keys(SCENE_OPTION_SCHEMAS).join(", ")}.`,
    );
  }
  const sceneOptions = sceneSchema.parse(options.sceneOptions);

  const fileName = options.fileName ?? `${slugify(ctx.target.name)}.mp4`;
  const outPath = ctx.resolveOutPath(fileName);

  // Resolve served files (e.g. fonts) to absolute paths (relative to the working dir).
  const filePaths: Record<string, string> = {};
  for (const [name, p] of Object.entries(options.files)) {
    filePaths[name] = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  }

  const server = await startSceneServer({
    staticDir: sceneAppDir(),
    inputs: { ...ctx.resolvedInputs, ...filePaths },
  });

  try {
    const inputUrls: Record<string, string> = {};
    for (const slot of Object.keys(ctx.resolvedInputs)) {
      inputUrls[slot] = server.inputUrl(slot);
    }
    const fileUrls: Record<string, string> = {};
    for (const name of Object.keys(filePaths)) {
      fileUrls[name] = server.inputUrl(name);
    }

    const props = {
      width: options.width,
      height: options.height,
      background: options.background,
      durationSeconds: options.durationSeconds,
      fps: options.fps,
      inputs: inputUrls,
      files: fileUrls,
      options: sceneOptions, // validated + defaulted against the scene's schema
    };
    const sceneUrl = new URL(`${server.origin}/`);
    sceneUrl.searchParams.set("scene", options.scene);
    sceneUrl.searchParams.set("props", JSON.stringify(props));

    await ensureDir(path.dirname(outPath));
    const composedTmp = path.join(ctx.tmpDir, `${slugify(ctx.target.name)}-scene.mp4`);

    const draft = ctx.quality === "draft";
    const preset = draft ? "ultrafast" : "medium";
    if (options.capture === "frames") {
      const workers = options.workers ?? autoWorkers();
      ctx.logger.info(
        `rendering scene "${options.scene}" (frame-stepped, ${workers} worker(s))`,
      );
      await captureSceneFrames({
        browser: ctx.browser,
        url: sceneUrl.toString(),
        width: options.width,
        height: options.height,
        deviceScaleFactor: options.deviceScaleFactor,
        fps: options.fps,
        durationSeconds: options.durationSeconds,
        crf: options.crf,
        outPath: composedTmp,
        preset,
        // Draft always uses fast jpeg intermediates; final uses the configured format (png = lossless).
        frameFormat: draft ? "jpeg" : options.frameFormat,
        jpegQuality: draft ? 70 : 90,
        workers,
        tmpDir: ctx.tmpDir,
        logger: ctx.logger,
      });
    } else {
      ctx.logger.info(`rendering scene "${options.scene}" (realtime)`);
      const recording = await recordSceneRealtime({
        browser: ctx.browser,
        url: sceneUrl.toString(),
        width: options.width,
        height: options.height,
        deviceScaleFactor: options.deviceScaleFactor,
        durationSeconds: options.durationSeconds,
        tmpDir: ctx.tmpDir,
        logger: ctx.logger,
      });
      await transcodeToMp4({
        inputPath: recording.path,
        outputPath: composedTmp,
        fps: options.fps,
        width: options.width,
        height: options.height,
        crf: options.crf,
        preset,
        // Trim the blank navigation/readiness lead so the clip opens on the first painted frame,
        // then clamp to the intended length so the output matches the manifest's durationMs.
        startOffsetSeconds: recording.leadSeconds,
        durationSeconds: options.durationSeconds,
        logger: ctx.logger,
      });
    }

    try {
      await rename(composedTmp, outPath);
    } catch {
      await copyFile(composedTmp, outPath);
    }

    const [dims, stats, contentHash] = await Promise.all([
      probeVideoDimensions(outPath),
      stat(outPath),
      sha256File(outPath),
    ]);
    const record: AssetRecord = {
      id: ctx.target.name,
      generator: generatorId,
      sourceUrl: ctx.target.url ?? `scene:${options.scene}`,
      file: ctx.toManifestPath(outPath),
      format: "mp4",
      width: dims?.width ?? options.width,
      height: dims?.height ?? options.height,
      durationMs: Math.round(options.durationSeconds * 1000),
      bytes: stats.size,
      contentHash,
      createdAt: new Date().toISOString(),
      toolVersion: ctx.toolVersion,
    };
    await ctx.writeAsset(record);
    ctx.logger.success(`${ctx.target.name} → ${record.file}`);
    return { assets: [record] };
  } finally {
    await server.close();
  }
}

export const sceneGenerator: Generator<ResolvedSceneOptions> = {
  id: SCENE_ID,
  optionsSchema: sceneOptionsSchema,
  // Served files (e.g. fonts) shape the output — hash their content into the cache key.
  fileDependencies: (options) => Object.values(options.files),
  run: (ctx, options) => renderScene(ctx, options),
};
