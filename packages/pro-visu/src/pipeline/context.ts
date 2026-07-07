import path from "node:path";
import type { Browser } from "playwright-core";
import { ensureDir } from "@/utils/fs";
import { generatorDir, relPosix } from "@/utils/paths";
import { withCaptureQuery } from "@/pipeline/capture";
import type { Logger } from "@/utils/logger";
import type { ResolvedCaptureSettings } from "@/config/schema";
import type { ManifestStore } from "@/manifest/manifest";
import type { AssetTarget, PipelineContext } from "@/generators/types";

export interface CreateContextArgs {
  browser: Browser;
  generatorId: string;
  target: AssetTarget;
  /** Absolute file paths of declared `inputs`, keyed by slot name. */
  resolvedInputs: Record<string, string>;
  /** Absolute output root. */
  outDir: string;
  tmpDir: string;
  logger: Logger;
  toolVersion: string;
  quality: "draft" | "final";
  manifest: ManifestStore;
  /** Capture-mode settings applied to every context (and folded into the target URL's query). */
  capture: ResolvedCaptureSettings;
  /** Forwarded to the live dashboard as this asset's progress (0–1). */
  onProgress?: (value: number) => void;
  /** Aborts in-flight work when the run is cancelled. */
  signal?: AbortSignal;
}

/** Build a per-(generator, target) context, ensuring the generator's output subdir exists. */
export async function createContext(args: CreateContextArgs): Promise<PipelineContext> {
  const genDir = generatorDir(args.outDir, args.generatorId);
  await ensureDir(genDir);

  return {
    browser: args.browser,
    // Fold the capture query params into the target URL so every generator's `requireUrl(ctx)`
    // captures in capture mode without each one re-applying it.
    target: { ...args.target, url: withCaptureQuery(args.target.url, args.capture) },
    capture: args.capture,
    resolvedInputs: args.resolvedInputs,
    outDir: args.outDir,
    resolveOutPath: (filename) => path.join(genDir, filename),
    toManifestPath: (absPath) => relPosix(args.outDir, absPath),
    tmpDir: args.tmpDir,
    logger: args.logger,
    toolVersion: args.toolVersion,
    quality: args.quality,
    writeAsset: (record) => args.manifest.upsert(record),
    progress: args.onProgress,
    signal: args.signal,
  };
}
