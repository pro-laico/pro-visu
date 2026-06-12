import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile, rename, stat } from "node:fs/promises";
import {
  sceneOptionsSchema,
  type ResolvedSceneOptions,
} from "@/generators/scene/options";
import { startSceneServer } from "@/scene/serve";
import { recordSceneRealtime } from "@/scene/capture-realtime";
import { captureSceneFrames } from "@/scene/capture-frames";
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
      options: options.sceneOptions,
    };
    const sceneUrl = new URL(`${server.origin}/`);
    sceneUrl.searchParams.set("scene", options.scene);
    sceneUrl.searchParams.set("props", JSON.stringify(props));

    await ensureDir(path.dirname(outPath));
    const composedTmp = path.join(ctx.tmpDir, `${slugify(ctx.target.name)}-scene.mp4`);

    if (options.capture === "frames") {
      const draft = ctx.quality === "draft";
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
        preset: draft ? "ultrafast" : "medium",
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
        // Trim the blank navigation/readiness lead so the clip opens on the first painted frame.
        startOffsetSeconds: recording.leadSeconds,
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

/** Default parallel workers: about half the cores, capped at 6 (each is a browser context). */
function autoWorkers(): number {
  const cores = os.cpus()?.length ?? 2;
  return Math.max(1, Math.min(6, Math.floor(cores / 2)));
}

export const sceneGenerator: Generator<ResolvedSceneOptions> = {
  id: SCENE_ID,
  optionsSchema: sceneOptionsSchema,
  run: (ctx, options) => renderScene(ctx, options),
};
