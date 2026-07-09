import path from "node:path";
import { imageSize } from "image-size";
import { readFile, writeFile } from "node:fs/promises";

import { ensureDir } from "@/utils/fs";
import { slugify } from "@/utils/paths";
import { sha256Buffer } from "@/utils/hash";
import type { AssetRecord } from "@/manifest/schema";
import { buildPaletteHtml } from "@/generators/palette/html";
import type { Generator, PipelineContext } from "@/generators/types";
import { paletteOptionsSchema, type ResolvedPaletteOptions } from "@/generators/palette/options";

export const PALETTE_ID = "palette";

const FONT_MIME: Record<string, string> = {
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

/** Read a custom font file into a base64 data URL so it can be embedded in the render (no server). */
async function fontDataUrl(fontFile: string): Promise<string> {
  const abs = path.isAbsolute(fontFile) ? fontFile : path.resolve(process.cwd(), fontFile);
  const mime = FONT_MIME[path.extname(abs).toLowerCase()] ?? "font/woff2";
  const data = await readFile(abs);
  return `data:${mime};base64,${data.toString("base64")}`;
}

/** Render the palette HTML and screenshot it to a PNG (static — no animation). */
async function run(ctx: PipelineContext, o: ResolvedPaletteOptions): Promise<{ assets: AssetRecord[] }> {
  const fileName = o.output.fileName ?? `${slugify(ctx.target.name)}.png`;
  const outPath = ctx.resolveOutPath(fileName);

  const dataUrl = o.text.fontFile ? await fontDataUrl(o.text.fontFile) : undefined;
  const html = buildPaletteHtml(o, dataUrl);

  ctx.logger.info(`rendering palette (${o.colors.length} colors, ${o.layout.layout})`);
  const context = await ctx.browser.newContext({
    viewport: { width: o.output.width, height: o.output.height },
    deviceScaleFactor: o.output.deviceScaleFactor,
  });
  let buffer: Buffer;
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });
    if (dataUrl) await page.evaluate(() => (globalThis as { document?: { fonts?: { ready?: Promise<unknown> } } }).document?.fonts?.ready); //TODO: replace `as` cast with proper typing
    buffer = await page.screenshot({ type: "png" });
  } finally {
    await context.close();
  }

  await ensureDir(path.dirname(outPath));
  await writeFile(outPath, buffer);

  const dims = imageSize(buffer);
  const record: AssetRecord = {
    id: ctx.target.name,
    generator: PALETTE_ID,
    sourceUrl: `palette:${o.colors.length}`,
    file: ctx.toManifestPath(outPath),
    format: "png",
    width: dims.width ?? o.output.width * o.output.deviceScaleFactor,
    height: dims.height ?? o.output.height * o.output.deviceScaleFactor,
    bytes: buffer.length,
    contentHash: sha256Buffer(buffer),
    createdAt: new Date().toISOString(),
    toolVersion: ctx.toolVersion,
  };
  await ctx.writeAsset(record);
  ctx.logger.success(`${ctx.target.name} → ${record.file}`);
  return { assets: [record] };
}

export const paletteGenerator: Generator<ResolvedPaletteOptions> = {
  id: PALETTE_ID,
  optionsSchema: paletteOptionsSchema,
  fileDependencies: (o) => (o.text.fontFile ? [o.text.fontFile] : []),
  run,
};
