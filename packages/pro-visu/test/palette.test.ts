import { describe, expect, it } from "vitest";
import { paletteOptionsSchema } from "@/generators/palette/options";
import { buildPaletteHtml } from "@/generators/palette/html";
import { generatorIds, getGenerator } from "@/generators/registry";
import { PALETTE_ID } from "@/generators/palette";

const COLORS = [
  { name: "Wet Grey", hex: "#D7DBDE" },
  { name: "Soft Grey", hex: "#ECF1F4" },
  { name: "Black", hex: "#171414" },
];

describe("palette options", () => {
  it("needs only colors, with defaults filled in", () => {
    const o = paletteOptionsSchema.parse({ colors: COLORS });
    expect(o.layout.layout).toBe("rows");
    expect(o.output.width).toBe(1400);
    expect(o.output.height).toBe(1750); // portrait 4:5
    expect(o.output.deviceScaleFactor).toBe(2);
    expect(o.fields.topLeft).toEqual(["name", "hex"]);
    expect(o.fields.topRight).toEqual(["rgb", "oklch"]);
    expect(o.text.fontWeight).toBe(700);
  });

  it("normalizes/validates hex and rejects bad colors + typos", () => {
    expect(paletteOptionsSchema.safeParse({ colors: [] }).success).toBe(false); // min 1
    expect(
      paletteOptionsSchema.safeParse({ colors: [{ name: "x", hex: "nope" }] }).success,
    ).toBe(false);
    expect(paletteOptionsSchema.safeParse({ colors: COLORS, colums: 3 }).success).toBe(false);
  });
});

describe("buildPaletteHtml", () => {
  const o = paletteOptionsSchema.parse({ colors: COLORS });

  it("renders one swatch per color with its background, name, hex, rgb and oklch", () => {
    const html = buildPaletteHtml(o);
    expect((html.match(/class="sw"/g) ?? []).length).toBe(3);
    expect(html).toContain("background:#D7DBDE");
    expect(html).toContain("Wet Grey");
    expect(html).toContain("#D7DBDE");
    expect(html).toContain("R:215,G:219,B:222");
    expect(html).toContain("oklch(");
  });

  it("auto-contrasts text (dark on light swatch, light on dark swatch)", () => {
    const html = buildPaletteHtml(o);
    expect(html).toContain("background:#ECF1F4;color:#141414"); // light → dark text
    expect(html).toContain("background:#171414;color:#ffffff"); // dark → light text
  });

  it("uses a flex column for rows and a grid for grid layout", () => {
    expect(buildPaletteHtml(o)).toContain("flex-direction:column");
    const grid = paletteOptionsSchema.parse({
      colors: COLORS,
      layout: { layout: "grid", gridColumns: 2 },
    });
    expect(buildPaletteHtml(grid)).toContain("grid-template-columns:repeat(2,1fr)");
  });

  it("embeds an @font-face only when a font data URL is supplied", () => {
    expect(buildPaletteHtml(o)).not.toContain("@font-face"); // no font → no @font-face
    expect(buildPaletteHtml(o, "data:font/woff2;base64,AAAA")).toContain("@font-face");
  });
});

describe("palette generator", () => {
  it("is registered and declares its font as a file dependency", () => {
    expect(generatorIds()).toContain(PALETTE_ID);
    const gen = getGenerator(PALETTE_ID);
    expect(gen?.id).toBe(PALETTE_ID);
    const o = paletteOptionsSchema.parse({ colors: COLORS, text: { fontFile: "fonts/X.woff2" } });
    expect(gen?.fileDependencies?.(o)).toEqual(["fonts/X.woff2"]);
    expect(gen?.fileDependencies?.(paletteOptionsSchema.parse({ colors: COLORS }))).toEqual([]);
  });
});
