import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { copyFile, mkdtemp, rename, stat } from "node:fs/promises";
import { chromium } from "playwright-core";
import {
  deviceFrameOptionsSchema,
  type ResolvedDeviceFrameOptions,
} from "@/generators/device-frame/options";
import { captureScrollWebm } from "@/generators/scroll-reel/capture";
import { ffmpegPath, probeVideoDimensions, transcodeToMp4 } from "@/media/ffmpeg";
import { ensureDir } from "@/utils/fs";
import { sha256File } from "@/utils/hash";
import { slugify } from "@/utils/paths";
import type { Logger } from "@/utils/logger";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const DEVICE_FRAME_ID = "device-frame";

/** Locate the bundled Revideo project (shipped via package.json "files"). */
function revideoDir(): string {
  // At runtime this module is bundled into dist/cli/index.js, so package root is two up.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "revideo");
}

interface RenderArgs {
  inputFile: string;
  outDir: string;
  chromiumPath: string;
  variables: Record<string, unknown>;
  logger: Logger;
}

/** Spawn the standalone runner that drives Revideo's renderVideo(). */
function renderInChild(args: RenderArgs): Promise<string> {
  const dir = revideoDir();
  const runner = path.join(dir, "render-runner.mjs");
  const outFile = "framed.mp4";

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runner], {
      cwd: dir,
      env: {
        ...process.env,
        RV_INPUT: args.inputFile,
        PUPPETEER_EXECUTABLE_PATH: args.chromiumPath,
        PUPPETEER_SKIP_DOWNLOAD: "1",
        RV_PROJECT: "./project.ts",
        RV_OUTDIR: args.outDir,
        RV_OUTFILE: outFile,
        RV_FFMPEG: ffmpegPath(),
        RV_VARS: JSON.stringify(args.variables),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stdout.on("data", (d: Buffer) => args.logger.debug(d.toString().trim()));
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      args.logger.debug(d.toString().trim());
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const produced = path.join(args.outDir, outFile);
      if (code === 0 && existsSync(produced)) resolve(produced);
      else reject(new Error(`Revideo render failed (exit ${code}).\n${stderr.slice(-1500)}`));
    });
  });
}

async function run(
  ctx: PipelineContext,
  options: ResolvedDeviceFrameOptions,
): Promise<{ assets: AssetRecord[] }> {
  const fileName = options.fileName ?? `${slugify(ctx.target.name)}.mp4`;
  const outPath = ctx.resolveOutPath(fileName);

  // 1. Record the site (same capture path as scroll-reel).
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

  // 2. Composite the capture into the device frame via the child render runner, which
  //    serves the input over localhost for Revideo's <Video>.
  const renderOutDir = await mkdtemp(path.join(os.tmpdir(), "showcase-revideo-out-"));
  const durationSeconds =
    (options.startDelayMs + options.duration + options.endDwellMs) / 1000;

  ctx.logger.debug("compositing device frame (revideo)");
  const rendered = await renderInChild({
    inputFile: captureMp4,
    outDir: renderOutDir,
    chromiumPath: chromium.executablePath(),
    variables: {
      videoSrc: "/input.mp4",
      durationSeconds,
      background: options.background,
      videoWidth: options.frameWidth,
    },
    logger: ctx.logger,
  });

  // 3. Move into the showcase output dir.
  await ensureDir(path.dirname(outPath));
  try {
    await rename(rendered, outPath);
  } catch {
    await copyFile(rendered, outPath); // cross-device fallback
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
    width: dims?.width ?? 0,
    height: dims?.height ?? 0,
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
