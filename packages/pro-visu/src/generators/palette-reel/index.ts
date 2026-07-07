import {
  paletteReelOptionsSchema,
  type ResolvedPaletteReelOptions,
} from "@/generators/palette-reel/options";
import { formatField, normalizeHex, pickTextColor } from "@/generators/palette/color";
import { renderScene } from "@/scene-engine/render";
import type { ResolvedSceneOptions } from "@/scene-engine/options";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const PALETTE_REEL_ID = "palette-reel";

/**
 * Clip length derived from the timing knobs — must match the scene's `totalDuration(params)` exactly
 * so the last captured frame lands on the loop seam. Every color holds once and hands off once.
 * Mirrors palette-reel-timeline.ts.
 */
function deriveDurationMs(o: ResolvedPaletteReelOptions): number {
  const n = o.colors.length;
  const stops = n <= 1 ? n : o.bounce ? 2 * (n - 1) : n;
  return stops * (o.holdMs + o.transitionMs);
}

/** Map the friendly palette-reel options onto the `palette-reel` scene and render it. */
async function run(
  ctx: PipelineContext,
  o: ResolvedPaletteReelOptions,
): Promise<{ assets: AssetRecord[] }> {
  // Precompute every display string Node-side (the scene is a separate bundle that can't import the
  // color math): per color a swatch hex, its contrast text color, the name, and the detail lines.
  const fmt = { uppercaseName: o.uppercase, rgbStyle: o.rgbStyle, oklchStyle: o.oklchStyle };
  const fields = o.details.filter((f) => f !== "name"); // the name is always shown separately
  const items = o.colors.map((color) => {
    const hex = normalizeHex(color.hex);
    return {
      name: formatField(color, "name", fmt),
      hex,
      textColor: pickTextColor(hex, {
        light: o.textLight,
        dark: o.textDark,
        threshold: o.contrastThreshold,
      }),
      details: fields.map((f) => formatField(color, f, fmt)),
    };
  });

  // The authoring surface is milliseconds; the scene wire format runs on seconds.
  const durationSeconds = (o.durationMs ?? deriveDurationMs(o)) / 1000;

  const sceneOptions: ResolvedSceneOptions = {
    scene: PALETTE_REEL_ID,
    width: o.width,
    height: o.height,
    background: o.background,
    deviceScaleFactor: o.deviceScaleFactor,
    fps: o.fps,
    durationSeconds,
    // The reveal is a deterministic, closed-form function of time (it publishes __sceneSeek), so the
    // frame-stepper renders it frame-exact with a perfect loop seam — no realtime recording jitter.
    capture: "frames",
    frameFormat: "jpeg",
    crf: o.crf,
    fileName: o.fileName,
    // Only serve a font slot when one is configured — renderScene path.resolves every files entry.
    files: o.fontFile ? { font: o.fontFile } : {},
    sceneOptions: {
      items,
      orientation: o.orientation,
      holdSeconds: o.holdMs / 1000,
      transitionSeconds: o.transitionMs / 1000,
      bounce: o.bounce,
      easing: o.easing,
      grownFlex: o.grownFlex,
      minCrossPx: o.minCrossPx,
      nameAlwaysVisible: o.nameAlwaysVisible,
      fontWeight: o.fontWeight,
      fontSize: o.fontSize,
      detailFontScale: o.detailFontScale,
      gap: o.gap,
      cornerRadius: o.cornerRadius,
    },
  };
  return renderScene(ctx, sceneOptions, PALETTE_REEL_ID);
}

export const paletteReelGenerator: Generator<ResolvedPaletteReelOptions> = {
  id: PALETTE_REEL_ID,
  optionsSchema: paletteReelOptionsSchema,
  // A custom font's content shapes the output — hash it into the cache key (edit font → regenerate).
  fileDependencies: (o) => (o.fontFile ? [o.fontFile] : []),
  run,
};
