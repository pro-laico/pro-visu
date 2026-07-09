import { renderScene } from "@/scene-engine/render";
import type { AssetRecord } from "@/manifest/schema";
import type { ResolvedSceneOptions } from "@/scene-engine/options";
import type { Generator, PipelineContext } from "@/generators/types";
import { specimenOptionsSchema, type ResolvedSpecimenOptions } from "@/generators/specimen/options";

export const SPECIMEN_ID = "specimen";

/** Map the friendly specimen options onto the `specimen` scene and render it. */
async function run(ctx: PipelineContext, o: ResolvedSpecimenOptions): Promise<{ assets: AssetRecord[] }> {
  const pulsesTotalMs = o.pulses.reduce((sum, p) => sum + p.durationMs, 0);
  const durationSeconds = (o.animation.durationMs ?? (o.animation.mirror ? pulsesTotalMs * 2 : pulsesTotalMs)) / 1000;
  const wirePulses = o.pulses.map(({ durationMs, ...p }) => ({ ...p, duration: durationMs / 1000 }));

  const sceneOptions: ResolvedSceneOptions = {
    scene: "specimen",
    width: o.output.width,
    height: o.output.height,
    background: o.colors.background,
    deviceScaleFactor: o.output.deviceScaleFactor,
    fps: o.output.fps,
    durationSeconds,
    capture: "frames",
    frameFormat: "jpeg",
    crf: o.output.crf,
    fileName: o.output.fileName,
    files: { font: o.font },
    sceneOptions: {
      label: { text: o.name, ...o.label },
      demo: o.animation.demo,
      weight: o.type.weight,
      lines: o.type.lines,
      fill: o.type.fill,
      leading: o.type.leading,
      blacklist: o.type.blacklist,
      characterPool: o.type.characterPool,
      colors: o.colors,
      colorWeights: o.colorWeights,
      pulses: wirePulses,
      mirror: o.animation.mirror,
      characterIntensity: o.animation.characterIntensity,
      colorIntensity: o.animation.colorIntensity,
      maxLineDrift: o.animation.maxLineDrift,
      seed: o.animation.seed,
    },
  };
  return renderScene(ctx, sceneOptions, SPECIMEN_ID);
}

export const specimenGenerator: Generator<ResolvedSpecimenOptions> = {
  id: SPECIMEN_ID,
  optionsSchema: specimenOptionsSchema,
  fileDependencies: (o) => [o.font],
  run,
};
