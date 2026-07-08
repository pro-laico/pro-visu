import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import type { Browser } from "playwright-core";
import { launchBrowser } from "@/pipeline/browser";
import { createContext } from "@/pipeline/context";
import { buildGraph, dependenciesOf, resolveSelection } from "@/pipeline/graph";
import { computeCacheKey } from "@/pipeline/cache";
import type { Reporter } from "@/pipeline/reporter";
import { getGenerator } from "@/generators/registry";
import { ManifestStore } from "@/manifest/manifest";
import { ensureDir, removeDir } from "@/utils/fs";
import { sha256File } from "@/utils/hash";
import { ZodError } from "zod";
import { legacyGeneratorHint, legacyOptionHint } from "@/generators/migration";
import type { ResolvedAssetSpec, ResolvedConfig } from "@/config/schema";
import type { Logger } from "@/utils/logger";
import type { AssetRecord } from "@/manifest/schema";

/** Render option-validation issues as pointed `options.path: message` bullets (+ rename hints). */
function describeOptionIssues(generatorId: string, err: ZodError): string {
  return err.issues
    .map((issue) => {
      const where = ["options", ...issue.path].join(".");
      const hint = legacyOptionHint(generatorId, issue);
      return `  • ${where}: ${issue.message}${hint ? ` — ${hint}` : ""}`;
    })
    .join("\n");
}

export interface AssetOutcome {
  name: string;
  generator: string;
  status: "ok" | "failed";
  records: AssetRecord[];
  error?: Error;
  /** True when the asset was served from cache (skipped, unchanged). */
  cached?: boolean;
  /** True when the asset was aborted in-flight by a cancel (not a real failure). */
  cancelled?: boolean;
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
  /** Render quality for this run (from --draft); defaults to "final". */
  quality?: "draft" | "final";
  /** Override settings.cache (skip unchanged assets). */
  cache?: boolean;
  /** Live progress sink (job tracker). Optional. */
  reporter?: Reporter;
  /** Aborts the run gracefully: stop launching new assets and let in-flight ones finish. */
  signal?: AbortSignal;
  /** Reports the run's temp working dir so the caller can track it for cleanup after a hard kill. */
  onResources?: (info: { tmpDir: string }) => void;
}

/**
 * Draft trades fidelity for iteration speed: fewer frames, no retina scale, looser quality.
 * Applied to the shared `output` group (fps / deviceScaleFactor / crf) across generators before
 * validation — only clamps fields that are explicitly set.
 */
export function applyQuality(
  options: Record<string, unknown>,
  quality: "draft" | "final",
): Record<string, unknown> {
  if (quality !== "draft") return options;
  const o = { ...options };
  if (!isPlainObject(o.output)) return o;
  const out = { ...o.output };
  if (typeof out.fps === "number") out.fps = Math.min(out.fps as number, 15);
  if (typeof out.deviceScaleFactor === "number") out.deviceScaleFactor = 1;
  if (typeof out.crf === "number") out.crf = Math.max(out.crf as number, 30);
  o.output = out;
  return o;
}

/**
 * Generate each selected asset, isolating failures so one bad asset never aborts the run.
 * Assets form a dependency DAG (via `inputs`): a producer runs before its consumers, and its
 * output file is exposed to them. Independent assets run up to `concurrency` at a time; one
 * shared browser + one manifest store for the whole run.
 */
export async function runPipeline(opts: RunOptions): Promise<AssetOutcome[]> {
  applyDerivedInputs(opts.config); // generators that declare deps via options (e.g. wall columns)
  buildGraph(opts.config.assets); // validate refs + reject cycles up front
  const specs = resolveSelection(opts.config.assets, opts.assetNames, opts.config.settings.enabled);
  if (specs.length === 0) return [];

  await ensureDir(opts.outDir);
  const manifest = await ManifestStore.load(opts.outDir);
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "pro-visu-"));
  // Launch Chromium lazily, on the first asset that actually renders: a fully-cached rerun (the
  // common iteration loop) then skips browser startup entirely. Shared across concurrent assets.
  const browserRef: { current: Promise<Browser> | null } = { current: null };
  const getBrowser = (): Promise<Browser> =>
    (browserRef.current ??= launchBrowser(opts.config.settings.browser));
  opts.onResources?.({ tmpDir: tmpRoot });
  const concurrency = Math.max(1, opts.concurrency ?? opts.config.settings.concurrency);
  const quality = opts.quality ?? "final";
  const cacheEnabled = opts.cache ?? opts.config.settings.cache;
  const reporter = opts.reporter;
  for (const s of specs) {
    reporter?.add({ id: s.name, name: s.name, detail: s.generator, deps: dependenciesOf(s) });
  }

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
      if (!generator) {
        const legacy = legacyGeneratorHint(spec.generator);
        throw new Error(`Unknown generator "${spec.generator}".${legacy ? ` ${legacy}.` : ""}`);
      }

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

      // Hash the content of declared file dependencies (e.g. fonts) into the cache key, so
      // editing the file regenerates the asset. Missing files fail here, early and clearly,
      // instead of producing a blank render from a 404'd URL later.
      let fileHashes: Record<string, string> | undefined;
      for (const dep of generator.fileDependencies?.(options) ?? []) {
        const resolved = path.isAbsolute(dep) ? dep : path.resolve(process.cwd(), dep);
        try {
          (fileHashes ??= {})[resolved] = await sha256File(resolved);
        } catch {
          throw new Error(`File dependency not found: ${dep}`);
        }
      }

      const cacheKey = computeCacheKey({
        name: spec.name,
        generator: spec.generator,
        url: spec.url,
        options,
        inputs: inputHashes,
        files: fileHashes,
        quality,
        toolVersion: opts.toolVersion,
        // Capture-mode toggles change the rendered output, so a change must bust the cache.
        capture: opts.config.settings.capture,
      });

      if (cacheEnabled) {
        // Match ALL of the spec's records (primary + suffixed variants) — generators like
        // `screenshots` emit only suffixed records, so a bare find(spec.name) never hit for them
        // and they recaptured (and relaunched the browser) on every run.
        const existing = manifest
          .recordsFor(spec.name)
          .filter((record) => record.cacheKey === cacheKey);
        if (
          existing.length > 0 &&
          existing.every((record) => existsSync(path.resolve(opts.outDir, record.file)))
        ) {
          log.info("cached — unchanged, skipped");
          reporter?.status(spec.name, "cached");
          recordDone(spec.name, existing[0]);
          return {
            name: spec.name,
            generator: spec.generator,
            status: "ok",
            records: existing,
            cached: true,
          };
        }
      }

      reporter?.status(spec.name, "running");

      const ctx = await createContext({
        browser: await getBrowser(), // first uncached asset pays the launch; cached runs never do
        generatorId: generator.id,
        target: { name: spec.name, url: spec.url },
        resolvedInputs,
        outDir: opts.outDir,
        tmpDir: tmpRoot,
        logger: log,
        toolVersion: opts.toolVersion,
        quality,
        manifest,
        capture: opts.config.settings.capture,
        onProgress: reporter ? (v) => reporter.progress(spec.name, v) : undefined,
        signal: opts.signal,
      });

      const result = await generator.run(ctx, options);
      // Stamp the cache key onto produced records (primary first) so reruns can skip.
      for (const record of result.assets) {
        record.cacheKey = cacheKey;
        await manifest.upsert(record);
      }
      recordDone(spec.name, result.assets[0]);
      reporter?.status(spec.name, "ok");
      return { name: spec.name, generator: spec.generator, status: "ok", records: result.assets };
    } catch (error) {
      // A ZodError's own .message is a raw JSON dump of its issues — reshape it into the same
      // pointed `options.path: message` bullets the config validator prints.
      const err =
        error instanceof ZodError
          ? new Error(`Invalid ${spec.generator} options:\n${describeOptionIssues(spec.generator, error)}`)
          : error instanceof Error
            ? error
            : new Error(String(error));
      // A cancelled run aborts in-flight work mid-flight: that's an expected stop, not a failure —
      // don't log a scary error or flag the row red; mark it cancelled and move on.
      if (opts.signal?.aborted) {
        return { name: spec.name, generator: spec.generator, status: "failed", records: [], error: err, cancelled: true };
      }
      log.error(err.message);
      reporter?.status(spec.name, "failed");
      return { name: spec.name, generator: spec.generator, status: "failed", records: [], error: err };
    }
  };

  try {
    await scheduleDag(specs, concurrency, outcomes, runSpec, reporter, opts.signal);
    return specs.map((s) => outcomes.get(s.name)).filter((o): o is AssetOutcome => Boolean(o));
  } finally {
    // The caller owns begin()/stop() (it spans the build/server setup rows too).
    if (browserRef.current) {
      try {
        await (await browserRef.current).close();
      } catch {
        /* launch failed (already surfaced per-asset) or browser already gone */
      }
    }
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
  reporter?: Reporter,
  signal?: AbortSignal,
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
    // Graceful stop: don't launch anything new; let in-flight assets finish, then drain. Un-started
    // assets are simply omitted from the results (not marked failed).
    if (signal?.aborted) remaining.clear();
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
        reporter?.status(name, "failed");
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
 * Merge each generator's option-derived dependencies (`deriveInputs`) into its asset's `inputs`,
 * in place, before the graph is built — so producers are ordered ahead of consumers that declared
 * their dependencies through options (e.g. a wall whose columns reference assets by name). Author-
 * declared `inputs` win on conflict. Options that fail to parse here are skipped; `runSpec`'s own
 * parse surfaces the real validation error for that asset.
 */
export function applyDerivedInputs(config: ResolvedConfig): void {
  for (const spec of config.assets) {
    const generator = getGenerator(spec.generator);
    if (!generator?.deriveInputs) continue;
    let options: unknown;
    try {
      options = generator.optionsSchema.parse(mergeGeneratorOptions(config.settings.defaults, spec));
    } catch {
      continue;
    }
    spec.inputs = { ...generator.deriveInputs(options), ...spec.inputs };
  }
}

/**
 * Merge a spec's options on top of the repo's per-generator defaults. Defaults are keyed
 * by generator id (the same string used in `assets[].generator`); per-asset options win.
 * Plain objects merge recursively — an asset that sets `cursor.color` keeps the default's
 * other `cursor` fields — while arrays and primitives replace wholesale.
 */
export function mergeGeneratorOptions(
  defaults: Record<string, Record<string, unknown>>,
  spec: ResolvedAssetSpec,
): Record<string, unknown> {
  const generatorDefaults = defaults[spec.generator] ?? {};
  return deepMerge(generatorDefaults, spec.options);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    out[key] = isPlainObject(existing) && isPlainObject(value) ? deepMerge(existing, value) : value;
  }
  return out;
}
