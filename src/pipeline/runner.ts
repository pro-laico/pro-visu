import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { launchBrowser } from "@/pipeline/browser";
import { createContext } from "@/pipeline/context";
import { buildGraph, dependenciesOf, expandSelection } from "@/pipeline/graph";
import { computeCacheKey } from "@/pipeline/cache";
import { getGenerator } from "@/generators/registry";
import { ManifestStore } from "@/manifest/manifest";
import { ensureDir, removeDir } from "@/utils/fs";
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
  /** Override settings.quality. */
  quality?: "draft" | "final";
  /** Override settings.cache (skip unchanged assets). */
  cache?: boolean;
}

/**
 * Draft trades fidelity for iteration speed: fewer frames, no retina scale, looser quality.
 * Applied to the common video-option names shared across generators before validation.
 */
export function applyQuality(
  options: Record<string, unknown>,
  quality: "draft" | "final",
): Record<string, unknown> {
  if (quality !== "draft") return options;
  const o = { ...options };
  if (typeof o.fps === "number") o.fps = Math.min(o.fps as number, 15);
  if (typeof o.deviceScaleFactor === "number") o.deviceScaleFactor = 1;
  if (typeof o.crf === "number") o.crf = Math.max(o.crf as number, 30);
  return o;
}

/**
 * Generate each selected asset, isolating failures so one bad asset never aborts the run.
 * Assets form a dependency DAG (via `inputs`): a producer runs before its consumers, and its
 * output file is exposed to them. Independent assets run up to `concurrency` at a time; one
 * shared browser + one manifest store for the whole run.
 */
export async function runPipeline(opts: RunOptions): Promise<AssetOutcome[]> {
  buildGraph(opts.config.assets); // validate refs + reject cycles up front
  const specs = expandSelection(opts.config.assets, opts.assetNames);
  if (specs.length === 0) return [];

  await ensureDir(opts.outDir);
  const manifest = await ManifestStore.load(opts.outDir);
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "auto-showcase-"));
  const browser = await launchBrowser(opts.config.settings.browser);
  const concurrency = Math.max(1, opts.concurrency ?? opts.config.settings.concurrency);
  const quality = opts.quality ?? opts.config.settings.quality;
  const cacheEnabled = opts.cache ?? opts.config.settings.cache;

  const outcomes = new Map<string, AssetOutcome>();
  /** Primary output (absolute path) per completed asset, for consumers' `inputs`. */
  const primaryOutput = new Map<string, string>();
  /** Primary output contentHash per completed asset, for consumers' cache keys. */
  const primaryHash = new Map<string, string>();

  const recordDone = (name: string, record: AssetRecord | undefined): void => {
    if (!record) return;
    primaryOutput.set(name, path.resolve(opts.outDir, record.file));
    primaryHash.set(name, record.contentHash);
  };

  const runSpec = async (spec: ResolvedAssetSpec): Promise<AssetOutcome> => {
    const log = opts.logger.withTag(spec.name);
    try {
      const generator = getGenerator(spec.generator);
      if (!generator) throw new Error(`Unknown generator "${spec.generator}".`);

      const resolvedInputs: Record<string, string> = {};
      const inputHashes: Record<string, string> = {};
      for (const [slot, dep] of Object.entries(spec.inputs)) {
        const file = primaryOutput.get(dep);
        if (!file) throw new Error(`Input "${slot}" (asset "${dep}") produced no file.`);
        resolvedInputs[slot] = file;
        inputHashes[slot] = primaryHash.get(dep) ?? "";
      }

      const merged = applyQuality(
        mergeGeneratorOptions(opts.config.settings.defaults, spec),
        quality,
      );
      const options = generator.optionsSchema.parse(merged);

      const cacheKey = computeCacheKey({
        generator: spec.generator,
        url: spec.url,
        options,
        inputs: inputHashes,
        quality,
        toolVersion: opts.toolVersion,
      });

      if (cacheEnabled) {
        const existing = manifest.find(spec.name);
        if (
          existing?.cacheKey === cacheKey &&
          existsSync(path.resolve(opts.outDir, existing.file))
        ) {
          log.info("cached — unchanged, skipped");
          recordDone(spec.name, existing);
          return { name: spec.name, generator: spec.generator, status: "ok", records: [existing] };
        }
      }

      const ctx = await createContext({
        browser,
        generatorId: generator.id,
        target: { name: spec.name, url: spec.url },
        resolvedInputs,
        outDir: opts.outDir,
        tmpDir: tmpRoot,
        logger: log,
        toolVersion: opts.toolVersion,
        quality,
        manifest,
      });

      const result = await generator.run(ctx, options);
      // Stamp the cache key onto produced records (primary first) so reruns can skip.
      for (const record of result.assets) {
        record.cacheKey = cacheKey;
        await manifest.upsert(record);
      }
      recordDone(spec.name, result.assets[0]);
      return { name: spec.name, generator: spec.generator, status: "ok", records: result.assets };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(err.message);
      return { name: spec.name, generator: spec.generator, status: "failed", records: [], error: err };
    }
  };

  try {
    await scheduleDag(specs, concurrency, outcomes, runSpec);
    return specs.map((s) => outcomes.get(s.name)).filter((o): o is AssetOutcome => Boolean(o));
  } finally {
    await browser.close();
    await removeDir(tmpRoot);
  }
}

/**
 * Run a dependency DAG with a concurrency cap: a spec starts once all its dependencies have
 * completed `ok`; if any dependency failed, the spec is skipped (recorded as failed). Cycles
 * were already rejected by buildGraph, so this always drains.
 */
async function scheduleDag(
  specs: ResolvedAssetSpec[],
  concurrency: number,
  outcomes: Map<string, AssetOutcome>,
  runSpec: (spec: ResolvedAssetSpec) => Promise<AssetOutcome>,
): Promise<void> {
  const remaining = new Map(specs.map((s) => [s.name, s]));
  const inflight = new Map<string, Promise<void>>();

  const depState = (spec: ResolvedAssetSpec): "ready" | "blocked" | "failed" => {
    let ready = true;
    for (const dep of dependenciesOf(spec)) {
      const r = outcomes.get(dep);
      if (!r) ready = false;
      else if (r.status === "failed") return "failed";
    }
    return ready ? "ready" : "blocked";
  };

  while (remaining.size > 0 || inflight.size > 0) {
    for (const [name, spec] of [...remaining]) {
      if (inflight.size >= concurrency) break;
      const state = depState(spec);
      if (state === "blocked") continue;
      remaining.delete(name);
      if (state === "failed") {
        outcomes.set(name, {
          name,
          generator: spec.generator,
          status: "failed",
          records: [],
          error: new Error("Skipped — a dependency failed."),
        });
        continue;
      }
      const p = runSpec(spec)
        .then((outcome) => {
          outcomes.set(name, outcome);
        })
        .finally(() => {
          inflight.delete(name);
        });
      inflight.set(name, p);
    }

    if (inflight.size > 0) {
      await Promise.race(inflight.values());
    } else if (remaining.size > 0) {
      // No work in flight and nothing became ready — only possible if every remaining spec is
      // blocked by a skipped dep. Re-loop resolves them as "failed"; guard against a spin.
      const stuck = [...remaining.values()].every((s) => depState(s) === "blocked");
      if (stuck) break;
    }
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
