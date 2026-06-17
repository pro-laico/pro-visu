import { wallOptionsSchema, type ResolvedWallOptions } from "@/generators/wall/options";
import { renderScene } from "@/generators/scene";
import type { ResolvedSceneOptions } from "@/generators/scene/options";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const WALL_ID = "wall";

/** Map the friendly wall options onto the `wall` scene and render it through the scene engine. */
async function run(ctx: PipelineContext, o: ResolvedWallOptions): Promise<{ assets: AssetRecord[] }> {
  const sceneOptions: ResolvedSceneOptions = {
    scene: "wall",
    width: o.width,
    height: o.height,
    background: o.background,
    deviceScaleFactor: o.deviceScaleFactor,
    fps: o.fps,
    durationSeconds: o.durationSeconds,
    capture: o.capture,
    workers: o.workers,
    frameFormat: o.frameFormat,
    crf: o.crf,
    fileName: o.fileName,
    files: {},
    sceneOptions: {
      columns: o.columns,
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
 * The wall declares its dependencies through its columns: every tile is an asset name, so the
 * pipeline can derive the `inputs` map (slot === asset name) instead of the author maintaining a
 * separate list. The `Wall` scene resolves a column's tiles → urls via these slots. In `test`
 * (preview) mode the tiles are faux color boxes, so there are NO real dependencies — return none
 * (column tile names need not reference real assets) and nothing has to be generated first.
 */
function deriveInputs(o: ResolvedWallOptions): Record<string, string> {
  if (o.test) return {};
  const map: Record<string, string> = {};
  for (const col of o.columns) for (const name of col.tiles) map[name] = name;
  return map;
}

export const wallGenerator: Generator<ResolvedWallOptions> = {
  id: WALL_ID,
  optionsSchema: wallOptionsSchema,
  deriveInputs,
  run,
};
