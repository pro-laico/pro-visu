import path from "node:path";
import { imageSize } from "image-size";
import { fileURLToPath } from "node:url";
import { copyFile, rename, stat, writeFile } from "node:fs/promises";

import { ensureDir } from "@/utils/fs";
import { slugify } from "@/utils/paths";
import type { AssetRecord } from "@/manifest/schema";
import { autoWorkers } from "@/recorder/frame-capture";
import { startSceneServer } from "@/scene-engine/serve";
import { sha256Buffer, sha256File } from "@/utils/hash";
import type { PipelineContext } from "@/generators/types";
import type { ResolvedSceneOptions } from "@/scene-engine/options";
import { captureSceneFrames } from "@/scene-engine/capture-frames";
import { SCENE_OPTION_SCHEMAS } from "@/scene-engine/scene-options";
import { recordSceneRealtime } from "@/scene-engine/capture-realtime";
import { probeVideoDimensions, transcodeToMp4 } from "@/media/ffmpeg";

const SCENE_ID = "scene";

/** The built scene app shipped alongside the CLI bundle (dist/scene-app). */
function sceneAppDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
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
  //TODO: replace `as` cast with proper typing
  const sceneSchema = SCENE_OPTION_SCHEMAS[options.scene as keyof typeof SCENE_OPTION_SCHEMAS];
  if (!sceneSchema) {
    throw new Error(`Unknown scene "${options.scene}". Available: ${Object.keys(SCENE_OPTION_SCHEMAS).join(", ")}.`);
  }
  const sceneOptions = sceneSchema.parse(options.sceneOptions);

  const defaultExt = options.capture === "still" ? "png" : "mp4";
  const fileName = options.fileName ?? `${slugify(ctx.target.name)}.${defaultExt}`;
  const outPath = ctx.resolveOutPath(fileName);

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
      options: sceneOptions,
    };
    const sceneUrl = new URL(`${server.origin}/`);
    sceneUrl.searchParams.set("scene", options.scene);
    sceneUrl.searchParams.set("props", JSON.stringify(props));

    if (options.capture === "still") {
      const stillTime = options.stillTimeSeconds ?? 0;
      await ensureDir(path.dirname(outPath));
      ctx.logger.info(`rendering scene "${options.scene}" (still @ ${stillTime}s)`);
      const context = await ctx.browser.newContext({
        viewport: { width: options.width, height: options.height },
        deviceScaleFactor: options.deviceScaleFactor,
      });
      let buffer: Buffer;
      try {
        const page = await context.newPage();
        await page.goto(sceneUrl.toString(), { waitUntil: "load" });
        //TODO: replace `as` cast with proper typing
        await page.waitForFunction(
          () => (globalThis as { __showcaseReady?: boolean }).__showcaseReady === true,
          undefined,
          { timeout: 30_000 },
        );
        //TODO: replace `as` cast with proper typing
        await page.evaluate(
          (t) =>
            (globalThis as { __showcase?: { seek(t: number): Promise<void> } }).__showcase?.seek(t),
          stillTime,
        );
        buffer = await page.screenshot({ type: "png" });
      } finally {
        await context.close();
      }
      await writeFile(outPath, buffer);
      const dims = imageSize(buffer);
      const stillRecord: AssetRecord = {
        id: ctx.target.name,
        generator: generatorId,
        sourceUrl: ctx.target.url ?? `scene:${options.scene}`,
        file: ctx.toManifestPath(outPath),
        format: "png",
        width: dims.width ?? options.width * options.deviceScaleFactor,
        height: dims.height ?? options.height * options.deviceScaleFactor,
        bytes: buffer.length,
        contentHash: sha256Buffer(buffer),
        createdAt: new Date().toISOString(),
        toolVersion: ctx.toolVersion,
      };
      await ctx.writeAsset(stillRecord);
      ctx.logger.success(`${ctx.target.name} → ${stillRecord.file}`);
      return { assets: [stillRecord] };
    }

    await ensureDir(path.dirname(outPath));
    const composedTmp = path.join(ctx.tmpDir, `${slugify(ctx.target.name)}-scene.mp4`);

    const draft = ctx.quality === "draft";
    const preset = draft ? "ultrafast" : "medium";
    if (options.capture === "frames") {
      const workers = options.workers ?? autoWorkers();
      ctx.logger.info(`rendering scene "${options.scene}" (frame-stepped, ${workers} worker(s))`);
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
        frameFormat: draft ? "jpeg" : options.frameFormat,
        jpegQuality: draft ? 70 : 90,
        workers,
        tmpDir: ctx.tmpDir,
        logger: ctx.logger,
        onProgress: ctx.progress,
        signal: ctx.signal,
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
        startOffsetSeconds: recording.leadSeconds,
        durationSeconds: options.durationSeconds,
        logger: ctx.logger,
        signal: ctx.signal,
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
