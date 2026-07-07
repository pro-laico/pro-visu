import {
  specimenOptionsSchema,
  type ResolvedSpecimenOptions,
} from "@/generators/specimen/options";
import { renderScene } from "@/scene-engine/render";
import type { ResolvedSceneOptions } from "@/scene-engine/options";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const SPECIMEN_ID = "specimen";

/** Map the friendly specimen options onto the `specimen` scene and render it. */
async function run(
  ctx: PipelineContext,
  o: ResolvedSpecimenOptions,
): Promise<{ assets: AssetRecord[] }> {
  // Clip length follows the composed pulses (doubled when mirrored for a seamless loop) unless
  // explicitly overridden. The authoring surface is milliseconds; the scene wire format is seconds.
  const pulsesTotalMs = o.pulses.reduce((sum, p) => sum + p.durationMs, 0);
  const durationSeconds = (o.durationMs ?? (o.mirror ? pulsesTotalMs * 2 : pulsesTotalMs)) / 1000;
  const wirePulses = o.pulses.map(({ durationMs, ...p }) => ({ ...p, duration: durationMs / 1000 }));

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
      // The scene receives the label as one object: its text (from `name`) plus placement/styling.
      label: { text: o.name, ...o.label },
      demo: o.demo,
      weight: o.weight,
      lines: o.lines,
      leading: o.leading,
      blacklist: o.blacklist,
      characterPool: o.characterPool,
      colors: o.colors,
      colorWeights: o.colorWeights,
      pulses: wirePulses,
      mirror: o.mirror,
      characterIntensity: o.characterIntensity,
      colorIntensity: o.colorIntensity,
      maxLineDrift: o.maxLineDrift,
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
