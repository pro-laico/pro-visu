import {
  specimenOptionsSchema,
  type ResolvedSpecimenOptions,
} from "@/generators/specimen/options";
import { renderScene } from "@/generators/scene";
import type { ResolvedSceneOptions } from "@/generators/scene/options";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const SPECIMEN_ID = "specimen";

/** Map the friendly specimen options onto the `specimen` scene and render it. */
async function run(
  ctx: PipelineContext,
  o: ResolvedSpecimenOptions,
): Promise<{ assets: AssetRecord[] }> {
  const sceneOptions: ResolvedSceneOptions = {
    scene: "specimen",
    width: o.width,
    height: o.height,
    background: o.background,
    deviceScaleFactor: o.deviceScaleFactor,
    fps: o.fps,
    durationSeconds: o.durationSeconds,
    capture: "realtime", // the grid animates itself; record it live
    crf: o.crf,
    fileName: o.fileName,
    files: { font: o.font },
    sceneOptions: {
      label: o.name,
      columns: o.columns,
      rows: o.rows,
      weight: o.weight,
      bold: o.bold,
      mid: o.mid,
      dim: o.dim,
    },
  };
  return renderScene(ctx, sceneOptions, SPECIMEN_ID);
}

export const specimenGenerator: Generator<ResolvedSpecimenOptions> = {
  id: SPECIMEN_ID,
  optionsSchema: specimenOptionsSchema,
  run,
};
