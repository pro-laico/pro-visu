import { renderScene } from "@/scene-engine/render";
import type { AssetRecord } from "@/manifest/schema";
import type { ResolvedSceneOptions } from "@/scene-engine/options";
import type { Generator, PipelineContext } from "@/generators/types";
import { formatField, normalizeHex, pickTextColor } from "@/generators/palette/color";
import { paletteReelOptionsSchema, type ResolvedPaletteReelOptions } from "@/generators/palette-reel/options";

export const PALETTE_REEL_ID = "palette-reel";

/**
 * Clip length derived from the timing knobs — must match the scene's `totalDuration(params)` exactly
 * so the last captured frame lands on the loop seam. Every color holds once and hands off once.
 * Mirrors palette-reel-timeline.ts.
 */
function deriveDurationMs(o: ResolvedPaletteReelOptions): number {
  const n = o.colors.length;
  const stops = n <= 1 ? n : o.timing.bounce ? 2 * (n - 1) : n;
  return stops * (o.timing.holdMs + o.timing.transitionMs);
}

/** Map the friendly palette-reel options onto the `palette-reel` scene and render it. */
async function run(ctx: PipelineContext, o: ResolvedPaletteReelOptions): Promise<{ assets: AssetRecord[] }> {
  const fmt = { uppercaseName: o.text.uppercase, rgbStyle: o.text.rgbStyle, oklchStyle: o.text.oklchStyle };
  const fields = o.details.filter((f) => f !== "name");
  const items = o.colors.map((color) => {
    const hex = normalizeHex(color.hex);
    return {
      name: formatField(color, "name", fmt),
      hex,
      textColor: pickTextColor(hex, { light: o.contrast.textLight, dark: o.contrast.textDark, threshold: o.contrast.contrastThreshold }),
      details: fields.map((f) => formatField(color, f, fmt)),
    };
  });

  const durationSeconds = (o.timing.durationMs ?? deriveDurationMs(o)) / 1000;

  const sceneOptions: ResolvedSceneOptions = {
    scene: PALETTE_REEL_ID,
    width: o.output.width,
    height: o.output.height,
    background: o.layout.background,
    deviceScaleFactor: o.output.deviceScaleFactor,
    fps: o.output.fps,
    durationSeconds,
    capture: "frames",
    frameFormat: "jpeg",
    crf: o.output.crf,
    fileName: o.output.fileName,
    files: o.text.fontFile ? { font: o.text.fontFile } : {},
    sceneOptions: {
      items,
      orientation: o.layout.orientation,
      holdSeconds: o.timing.holdMs / 1000,
      transitionSeconds: o.timing.transitionMs / 1000,
      bounce: o.timing.bounce,
      easing: o.timing.easing,
      grownFlex: o.layout.grownFlex,
      minCrossPx: o.layout.minCrossPx,
      nameAlwaysVisible: o.layout.nameAlwaysVisible,
      fontWeight: o.text.fontWeight,
      fontSize: o.text.fontSize,
      detailFontScale: o.text.detailFontScale,
      gap: o.layout.gap,
      cornerRadius: o.layout.cornerRadius,
    },
  };
  return renderScene(ctx, sceneOptions, PALETTE_REEL_ID);
}

export const paletteReelGenerator: Generator<ResolvedPaletteReelOptions> = {
  id: PALETTE_REEL_ID,
  optionsSchema: paletteReelOptionsSchema,
  fileDependencies: (o) => (o.text.fontFile ? [o.text.fontFile] : []),
  run,
};
