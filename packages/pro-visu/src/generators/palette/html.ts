import { formatField, pickTextColor, type FieldId } from "@/generators/palette/color";
import type { ResolvedPaletteOptions } from "@/generators/palette/options";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Corner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

/** One corner block of stacked field lines (empty string if no fields placed there). */
function corner(
  o: ResolvedPaletteOptions,
  color: { name: string; hex: string },
  which: Corner,
  fields: FieldId[],
): string {
  if (!fields.length) return "";
  const vert = which.startsWith("top") ? "top:0" : "bottom:0";
  const horiz = which.endsWith("Left") ? "left:0;text-align:left" : "right:0;text-align:right";
  const lines = fields
    .map(
      (f) =>
        `<div>${esc(
          formatField(color, f, {
            uppercaseName: o.text.uppercase,
            rgbStyle: o.text.rgbStyle,
            oklchStyle: o.text.oklchStyle,
          }),
        )}</div>`,
    )
    .join("");
  return `<div class="cnr" style="${vert};${horiz}">${lines}</div>`;
}

/** Build a fully self-contained palette HTML document (inline CSS). Pure — unit-tested. */
export function buildPaletteHtml(o: ResolvedPaletteOptions, fontDataUrl?: string): string {
  const fontSize = o.text.fontSize ?? Math.round(o.output.width * 0.02);
  const pad = o.layout.padding ?? Math.round(o.output.width * 0.025);
  const fontFace = fontDataUrl
    ? `@font-face{font-family:'PaletteFont';src:url(${fontDataUrl});font-weight:1 1000;font-display:block;}`
    : "";
  const family = fontDataUrl
    ? `'PaletteFont', "Helvetica Neue", Arial, sans-serif`
    : `"Helvetica Neue", Arial, "Segoe UI", system-ui, sans-serif`;

  // The container that arranges the swatches per layout.
  let container: string;
  if (o.layout.layout === "columns") {
    container = `display:flex;flex-direction:row;gap:${o.layout.gap}px`;
  } else if (o.layout.layout === "grid") {
    container = `display:grid;grid-template-columns:repeat(${o.layout.gridColumns},1fr);gap:${o.layout.gap}px`;
  } else {
    container = `display:flex;flex-direction:column;gap:${o.layout.gap}px`;
  }
  // rows/columns share their long axis equally; grid cells fill their track.
  const swatchFlex = o.layout.layout === "grid" ? "" : "flex:1 1 0;min-width:0;min-height:0;";

  const swatches = o.colors
    .map((color) => {
      const text = pickTextColor(color.hex, {
        light: o.contrast.textLight,
        dark: o.contrast.textDark,
        threshold: o.contrast.contrastThreshold,
      });
      const corners =
        corner(o, color, "topLeft", o.fields.topLeft) +
        corner(o, color, "topRight", o.fields.topRight) +
        corner(o, color, "bottomLeft", o.fields.bottomLeft) +
        corner(o, color, "bottomRight", o.fields.bottomRight);
      return `<div class="sw" style="background:${esc(color.hex)};color:${text};${swatchFlex}">${corners}</div>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
${fontFace}
html,body{width:${o.output.width}px;height:${o.output.height}px}
body{background:${esc(o.layout.background)};font-family:${family};font-weight:${o.text.fontWeight};
  font-size:${fontSize}px;line-height:1.12;letter-spacing:-0.01em}
.wrap{width:${o.output.width}px;height:${o.output.height}px;${container}}
.sw{position:relative;overflow:hidden;border-radius:${o.layout.cornerRadius}px}
.cnr{position:absolute;padding:${pad}px}
.cnr>div{white-space:nowrap}
</style></head><body><div class="wrap">${swatches}</div></body></html>`;
}
