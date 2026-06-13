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
    width: o.width,
    height: o.height,
    background: o.colors.background,
    deviceScaleFactor: o.deviceScaleFactor,
    fps: o.fps,
    durationSeconds,
    // The specimen's animation is a seeded, deterministic function of time (it publishes
    // __sceneSeek), so the frame-stepper renders it frame-exact: single encode, supersampling via
    // deviceScaleFactor, and a perfect loop seam — no realtime recording jitter.
    capture: "frames",
    frameFormat: "jpeg",
    crf: o.crf,
    fileName: o.fileName,
    files: { font: o.font },
    sceneOptions: {
      label: o.name,
      demo: o.demo,
      weight: o.weight,
      characters: o.characters,
      fontSize: o.fontSize,
      leading: o.leading,
      blacklist: o.blacklist,
      characterPool: o.characterPool,
      colors: o.colors,
      colorWeights: o.colorWeights,
      pulses: o.pulses,
      mirror: o.mirror,
      characterIntensity: o.characterIntensity,
      colorIntensity: o.colorIntensity,
      seed: o.seed,
    },
  };
  return renderScene(ctx, sceneOptions, SPECIMEN_ID);
}

export const specimenGenerator: Generator<ResolvedSpecimenOptions> = {
  id: SPECIMEN_ID,
  optionsSchema: specimenOptionsSchema,
  // The font's CONTENT shapes the output — hash it into the cache key (edit font → regenerate).
  fileDependencies: (o) => [o.font],
  run,
};
