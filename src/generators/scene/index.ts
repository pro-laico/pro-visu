import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile, rename, stat } from "node:fs/promises";
import {
  sceneOptionsSchema,
  type ResolvedSceneOptions,
} from "@/generators/scene/options";
import { startSceneServer } from "@/scene/serve";
import { recordSceneRealtime } from "@/scene/capture-realtime";
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

async function run(
  ctx: PipelineContext,
  options: ResolvedSceneOptions,
): Promise<{ assets: AssetRecord[] }> {
  const fileName = options.fileName ?? `${slugify(ctx.target.name)}.mp4`;
  const outPath = ctx.resolveOutPath(fileName);

  const server = await startSceneServer({
    staticDir: sceneAppDir(),
    inputs: ctx.resolvedInputs,
  });

  try {
    const inputUrls: Record<string, string> = {};
    for (const slot of Object.keys(ctx.resolvedInputs)) {
      inputUrls[slot] = server.inputUrl(slot);
    }

    const props = {
      width: options.width,
      height: options.height,
      background: options.background,
      durationSeconds: options.durationSeconds,
      fps: options.fps,
      inputs: inputUrls,
      options: options.sceneOptions,
    };
    const sceneUrl = new URL(`${server.origin}/`);
    sceneUrl.searchParams.set("scene", options.scene);
    sceneUrl.searchParams.set("props", JSON.stringify(props));

    if (options.capture === "frames") {
      ctx.logger.warn("frame-stepping is not available yet; using realtime capture.");
    }

    ctx.logger.info(`rendering scene "${options.scene}"`);
    const webmPath = await recordSceneRealtime({
      browser: ctx.browser,
      url: sceneUrl.toString(),
      width: options.width,
      height: options.height,
      deviceScaleFactor: options.deviceScaleFactor,
      durationSeconds: options.durationSeconds,
      tmpDir: ctx.tmpDir,
      logger: ctx.logger,
    });

    await ensureDir(path.dirname(outPath));
    const composedTmp = path.join(ctx.tmpDir, `${slugify(ctx.target.name)}-scene.mp4`);
    await transcodeToMp4({
      inputPath: webmPath,
      outputPath: composedTmp,
      fps: options.fps,
      width: options.width,
      height: options.height,
      crf: options.crf,
      logger: ctx.logger,
    });
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
      generator: SCENE_ID,
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
  run,
};
