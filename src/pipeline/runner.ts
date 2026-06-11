import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { launchBrowser } from "@/pipeline/browser";
import { createContext } from "@/pipeline/context";
import { getGenerator } from "@/generators/registry";
import { ManifestStore } from "@/manifest/manifest";
import { ensureDir, removeDir } from "@/utils/fs";
import { mapLimit } from "@/utils/concurrency";
import type { ResolvedAssetSpec, ResolvedConfig } from "@/config/schema";
import type { Logger } from "@/utils/logger";
import type { AssetRecord } from "@/manifest/schema";

export interface AssetOutcome {
  name: string;
  generator: string;
  status: "ok" | "failed";
  records: AssetRecord[];
  error?: Error;
}

export interface RunOptions {
  config: ResolvedConfig;
  /** Absolute output dir. */
  outDir: string;
  logger: Logger;
  toolVersion: string;
  /** Restrict to these asset names (undefined/empty = all). */
  assetNames?: string[];
  /** Override settings.concurrency. */
  concurrency?: number;
}

/**
 * Generate each selected asset, isolating failures so one bad asset never aborts the run.
 * One shared browser + one manifest store; assets run up to `concurrency` at a time.
 */
export async function runPipeline(opts: RunOptions): Promise<AssetOutcome[]> {
  const specs = selectSpecs(opts.config.assets, opts.assetNames);
  if (specs.length === 0) return [];

  await ensureDir(opts.outDir);
  const manifest = await ManifestStore.load(opts.outDir);
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "auto-showcase-"));
  const browser = await launchBrowser(opts.config.settings.browser);
  const concurrency = Math.max(1, opts.concurrency ?? opts.config.settings.concurrency);

  try {
    return await mapLimit(specs, concurrency, async (spec): Promise<AssetOutcome> => {
      const log = opts.logger.withTag(spec.name);
      try {
        const generator = getGenerator(spec.generator);
        if (!generator) {
          throw new Error(`Unknown generator "${spec.generator}".`);
        }
        const merged = mergeGeneratorOptions(opts.config.settings.defaults, spec);
        const options = generator.optionsSchema.parse(merged);

        const ctx = await createContext({
          browser,
          generatorId: generator.id,
          target: { name: spec.name, url: spec.url },
          outDir: opts.outDir,
          tmpDir: tmpRoot,
          logger: log,
          toolVersion: opts.toolVersion,
          manifest,
        });

        const result = await generator.run(ctx, options);
        return {
          name: spec.name,
          generator: spec.generator,
          status: "ok",
          records: result.assets,
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        log.error(err.message);
        return { name: spec.name, generator: spec.generator, status: "failed", records: [], error: err };
      }
    });
  } finally {
    await browser.close();
    await removeDir(tmpRoot);
  }
}

/**
 * Merge a spec's options on top of the repo's per-generator defaults. Defaults are keyed
 * by generator id (the same string used in `assets[].generator`); per-asset options win.
 */
export function mergeGeneratorOptions(
  defaults: Record<string, Record<string, unknown>>,
  spec: ResolvedAssetSpec,
): Record<string, unknown> {
  const generatorDefaults = defaults[spec.generator] ?? {};
  return { ...generatorDefaults, ...spec.options };
}

function selectSpecs(all: ResolvedAssetSpec[], names?: string[]): ResolvedAssetSpec[] {
  if (!names || names.length === 0) return all;
  const wanted = new Set(names);
  return all.filter((spec) => wanted.has(spec.name));
}
