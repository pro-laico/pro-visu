import type { Browser } from "playwright-core";
import type { ZodType, ZodTypeDef } from "zod";
import type { Logger } from "@/utils/logger";
import type { AssetRecord } from "@/manifest/schema";

/** The site/page an asset is generated for. `url` is absent for local `scene` assets. */
export interface AssetTarget {
  name: string;
  url?: string;
}

/**
 * Everything a generator needs, supplied by the pipeline. Created per (generator, target)
 * run, so `resolveOutPath` already points at this generator's subdirectory.
 */
export interface PipelineContext {
  /** Shared, already-launched browser. Generators create their own contexts. */
  browser: Browser;
  target: AssetTarget;
  /** Absolute file paths of this asset's declared `inputs`, keyed by slot name. */
  resolvedInputs: Record<string, string>;
  /** Absolute output root (e.g. <repo>/showcase). */
  outDir: string;
  /** Resolve a filename inside this generator's subdir: <outDir>/<generatorId>/<filename>. */
  resolveOutPath: (filename: string) => string;
  /** Convert an absolute output path to the posix-relative form stored in the manifest. */
  toManifestPath: (absPath: string) => string;
  /** Auto-cleaned scratch directory for intermediates. */
  tmpDir: string;
  logger: Logger;
  toolVersion: string;
  /** Record a produced asset in the manifest (idempotent by id). */
  writeAsset: (record: AssetRecord) => Promise<void>;
}

export interface GeneratorResult {
  assets: AssetRecord[];
}

/**
 * The plugin contract. A new asset type implements this and registers itself — the
 * pipeline core, CLI, and manifest need no changes.
 */
export interface Generator<TOptions = unknown> {
  /** Stable id used in config (`generator`) and the manifest. */
  id: string;
  /** zod schema validating + defaulting this generator's options. Input is loose. */
  optionsSchema: ZodType<TOptions, ZodTypeDef, unknown>;
  run(ctx: PipelineContext, options: TOptions): Promise<GeneratorResult>;
}
