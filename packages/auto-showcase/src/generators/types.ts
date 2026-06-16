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
  /** Active render quality; generators may trade fidelity for speed in "draft". */
  quality: "draft" | "final";
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
  /**
   * Whether this generator captures a `url`. When true and a managed server is configured, an
   * asset that omits `url` defaults to the server's URL; when false (e.g. `scene`, `palette`),
   * the asset needs no url. Defaults to false.
   */
  requiresUrl?: boolean;
  /** zod schema validating + defaulting this generator's options. Input is loose. */
  optionsSchema: ZodType<TOptions, ZodTypeDef, unknown>;
  /**
   * Local files (beyond declared asset inputs) whose CONTENT affects the output — e.g. a font
   * file. Paths as authored (relative to the cwd, or absolute). The pipeline hashes their content
   * into the cache key, so editing the file invalidates the cache; a missing file fails the asset
   * early with a clear error instead of rendering blank.
   */
  fileDependencies?(options: TOptions): string[];
  /**
   * Asset dependencies derived from this generator's options, as `{ slotName: assetName }`, merged
   * into the asset's authored `inputs` before the dependency graph is built. Lets a generator own
   * its dependency declaration in its options (e.g. the `wall`'s columns reference assets by name,
   * so there's no separate `inputs` map to hand-maintain). Author-declared `inputs` win on conflict.
   */
  deriveInputs?(options: TOptions): Record<string, string>;
  run(ctx: PipelineContext, options: TOptions): Promise<GeneratorResult>;
}
