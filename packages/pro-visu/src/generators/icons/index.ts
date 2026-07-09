import path from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { iconsOptionsSchema, type ResolvedIconsOptions } from "@/generators/icons/options";
import { renderScene } from "@/scene-engine/render";
import type { ResolvedSceneOptions } from "@/scene-engine/options";
import type { Generator, PipelineContext } from "@/generators/types";
import type { AssetRecord } from "@/manifest/schema";

export const ICONS_ID = "icons";

/** Raster/vector icon extensions a `dir` is expanded over (sorted by filename). */
const ICON_EXTS = new Set([".svg", ".png", ".webp", ".jpg", ".jpeg", ".gif", ".avif"]);

/** Absolute path from an authored path (relative to the working dir, or already absolute). */
function abs(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

/**
 * The ordered list of absolute icon paths for a config: `dir` expanded first (its image files sorted
 * by filename), then the explicit `icons` sources. Shared by `run` and `fileDependencies` so the
 * cache key and the render see the exact same set. A missing/unreadable `dir` yields no icons (the
 * error then surfaces as "no icons" in `run`, or a missing-file failure via `fileDependencies`).
 */
function collectIcons(o: ResolvedIconsOptions): string[] {
  const out: string[] = [];
  if (o.dir) {
    const dirAbs = abs(o.dir);
    let names: string[] = [];
    try {
      names = readdirSync(dirAbs);
    } catch {
      names = [];
    }
    for (const name of names.filter((n) => ICON_EXTS.has(path.extname(n).toLowerCase())).sort()) {
      out.push(path.join(dirAbs, name));
    }
  }
  for (const src of o.icons) {
    out.push(abs(typeof src === "string" ? src : src.src));
  }
  return out;
}

/** Map the friendly icon options onto the `icons` scene and render it (video or a single still). */
async function run(ctx: PipelineContext, o: ResolvedIconsOptions): Promise<{ assets: AssetRecord[] }> {
  const iconPaths = collectIcons(o);
  if (iconPaths.length === 0) {
    // Point at the actual cause: a bad `dir`, an empty `dir`, or nothing supplied at all.
    if (o.dir) {
      const dirAbs = abs(o.dir);
      if (!existsSync(dirAbs)) {
        throw new Error(`icons: dir not found — "${o.dir}" (resolved to ${dirAbs}).`);
      }
      throw new Error(
        `icons: no image files (svg/png/webp/jpg/gif/avif) in dir "${o.dir}"${o.icons.length ? " and no `icons` given" : ""}.`,
      );
    }
    throw new Error(
      "icons: no icons. Provide `icons` (paths and/or { src }) and/or a `dir` containing image files.",
    );
  }

  // A `color` step needs the CSS-mask tint; with `recolor: false` it silently no-ops (the icons
  // render in their native colours). Warn rather than let a recolour template quietly do nothing.
  if (o.layout.recolor === false && o.steps.some((s) => s.kind === "color")) {
    ctx.logger.warn(
      "icons: `layout.recolor` is false, so `color` steps have no effect (icons render natively). Enable recolor or drop the color steps.",
    );
  }

  // Rough legibility check: if the auto-fit cell will be tiny, the showcase reads as noise. Estimate
  // the fit the way the scene does (a near-square grid) and nudge the author before a long render.
  if (o.layout.iconSize == null) {
    const { width, height } = o.output;
    const cols = o.layout.columns ?? Math.max(1, Math.round(Math.sqrt(iconPaths.length * (width / height))));
    const rows = Math.ceil(iconPaths.length / cols);
    const cell = Math.floor(
      Math.min(
        (width - o.layout.padding * 2 - o.layout.gap * (cols - 1)) / cols,
        (height - o.layout.padding * 2 - o.layout.gap * (rows - 1)) / rows,
      ),
    );
    if (cell > 0 && cell < 48) {
      ctx.logger.warn(
        `icons: ${iconPaths.length} icons at ${width}×${height} render ~${cell}px each — small for a showcase. Raise the frame size, trim the set, or split it across assets.`,
      );
    }
  }

  // Each icon gets a stable, ordered served-file slot; the scene resolves the slot back to its URL.
  const files: Record<string, string> = {};
  const slots = iconPaths.map((p, i) => {
    const slot = `icon-${i}`;
    files[slot] = p;
    return slot;
  });

  const durationSeconds = o.motion.durationMs / 1000;
  const isImage = o.output.format === "image";

  const sceneOptions: ResolvedSceneOptions = {
    scene: "icons",
    width: o.output.width,
    height: o.output.height,
    background: o.layout.background,
    deviceScaleFactor: o.output.deviceScaleFactor,
    fps: o.output.fps,
    durationSeconds,
    // The animation is a deterministic function of time — frame-step it for a crisp, exact video;
    // a still just freezes the same timeline at one moment.
    capture: isImage ? "still" : "frames",
    stillTimeSeconds: isImage ? o.motion.posterTime * durationSeconds : 0,
    workers: o.output.workers,
    frameFormat: "png",
    crf: o.output.crf,
    fileName: o.output.fileName,
    files,
    sceneOptions: {
      icons: slots,
      columns: o.layout.columns,
      gap: o.layout.gap,
      padding: o.layout.padding,
      iconSize: o.layout.iconSize,
      background: o.layout.background,
      recolor: o.layout.recolor,
      baseColor: o.base.color,
      baseScale: o.base.scale,
      baseOpacity: o.base.opacity,
      steps: o.steps,
      seed: o.base.seed,
    },
  };
  return renderScene(ctx, sceneOptions, ICONS_ID);
}

/** The icons are local files: content-hashed into the cache key (edit an icon → regenerate). */
function fileDependencies(o: ResolvedIconsOptions): string[] {
  return [...new Set(collectIcons(o))];
}

export const iconsGenerator: Generator<ResolvedIconsOptions> = {
  id: ICONS_ID,
  optionsSchema: iconsOptionsSchema,
  fileDependencies,
  run,
};
