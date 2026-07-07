import path from "node:path";
import { wallOptionsSchema, type ResolvedWallOptions } from "@/generators/wall/options";
import { renderScene } from "@/scene-engine/render";
import type { ResolvedSceneOptions } from "@/scene-engine/options";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const WALL_ID = "wall";

/**
 * A `{ src }` tile's slot name in the scene wire format: readable and collision-free with asset
 * names (it embeds the full path).
 */
function srcSlot(src: string): string {
  return `file:${path.basename(src)}:${src}`;
}

/** Map the friendly wall options onto the `wall` scene and render it through the scene engine. */
async function run(ctx: PipelineContext, o: ResolvedWallOptions): Promise<{ assets: AssetRecord[] }> {
  // Wire columns carry slot names only; `{ src }` tiles become served files under a synthetic slot.
  const files: Record<string, string> = {};
  const wireColumns = o.columns.map((col) => ({
    ...col,
    tiles: col.tiles.map((tile) => {
      if (typeof tile === "string") return tile;
      const slot = srcSlot(tile.src);
      files[slot] = tile.src;
      return slot;
    }),
  }));

  const sceneOptions: ResolvedSceneOptions = {
    scene: "wall",
    width: o.width,
    height: o.height,
    background: o.background,
    deviceScaleFactor: o.deviceScaleFactor,
    fps: o.fps,
    // The scene wire format keeps seconds internally; the authoring surface is milliseconds.
    durationSeconds: o.durationMs / 1000,
    capture: o.capture,
    workers: o.workers,
    frameFormat: o.frameFormat,
    crf: o.crf,
    fileName: o.fileName,
    files,
    sceneOptions: {
      columns: wireColumns,
      gap: o.gap,
      tileAspect: o.tileAspect,
      cornerRadius: o.cornerRadius,
      background: o.background,
      pan: o.pan,
      loops: o.loops,
      pulses: o.pulses,
      test: o.test,
      testTiles: o.testTiles,
    },
  };
  return renderScene(ctx, sceneOptions, WALL_ID);
}

/**
 * The wall declares its dependencies through its columns: every string tile is an asset name, so
 * the pipeline can derive the `inputs` map (slot === asset name) instead of the author maintaining
 * a separate list. `{ src }` tiles are local files (no producer to run) and are hashed via
 * `fileDependencies` instead. In `test` (preview) mode the tiles are faux color boxes, so there
 * are NO dependencies and nothing has to be generated first.
 */
function deriveInputs(o: ResolvedWallOptions): Record<string, string> {
  if (o.test) return {};
  const map: Record<string, string> = {};
  for (const col of o.columns) {
    for (const tile of col.tiles) {
      if (typeof tile === "string") map[tile] = tile;
    }
  }
  return map;
}

/** `{ src }` tiles are file dependencies: content-hashed into the cache key, missing files fail early. */
function fileDependencies(o: ResolvedWallOptions): string[] {
  if (o.test) return [];
  const files: string[] = [];
  for (const col of o.columns) {
    for (const tile of col.tiles) {
      if (typeof tile !== "string") files.push(tile.src);
    }
  }
  return [...new Set(files)];
}

export const wallGenerator: Generator<ResolvedWallOptions> = {
  id: WALL_ID,
  optionsSchema: wallOptionsSchema,
  deriveInputs,
  fileDependencies,
  run,
};
