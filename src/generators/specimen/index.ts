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
  // Clip length follows the composed pulses (doubled when mirrored for a seamless loop) unless
  // explicitly overridden.
  const pulsesTotal = o.pulses.reduce((sum, p) => sum + p.duration, 0);
  const durationSeconds = o.durationSeconds ?? (o.mirror ? pulsesTotal * 2 : pulsesTotal);

  const sceneOptions: ResolvedSceneOptions = {
    scene: "specimen",
    // Standardized 16:9 frame — the specimen is always rendered at 1920×1080.
    width: 1920,
    height: 1080,
    background: o.colors.background,
    deviceScaleFactor: o.deviceScaleFactor,
    fps: o.fps,
    durationSeconds,
    capture: "realtime", // the scene animates itself on a timeline; record it live
    crf: o.crf,
    fileName: o.fileName,
    files: { font: o.font },
    sceneOptions: {
      label: o.name,
      demo: o.demo,
      weight: o.weight,
      characters: o.characters,
      fontSize: o.fontSize,
      blacklist: o.blacklist,
      colors: o.colors,
      colorWeights: o.colorWeights,
      pulses: o.pulses,
      mirror: o.mirror,
      characterIntensity: o.characterIntensity,
      colorIntensity: o.colorIntensity,
    },
  };
  return renderScene(ctx, sceneOptions, SPECIMEN_ID);
}

export const specimenGenerator: Generator<ResolvedSpecimenOptions> = {
  id: SPECIMEN_ID,
  optionsSchema: specimenOptionsSchema,
  run,
};
