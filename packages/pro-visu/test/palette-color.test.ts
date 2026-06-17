import { describe, expect, it } from "vitest";
import {
  formatField,
  hexToRgb,
  normalizeHex,
  pickTextColor,
  rgbToCmyk,
  rgbToHsl,
  rgbToOklch,
} from "@/generators/palette/color";

describe("normalizeHex / hexToRgb", () => {
  it("normalizes shorthand + case to #RRGGBB", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("d7dbde")).toBe("#D7DBDE");
    expect(normalizeHex("#FFFFFF")).toBe("#FFFFFF");
  });
  it("rejects invalid hex", () => {
    expect(() => normalizeHex("#12")).toThrow();
    expect(() => normalizeHex("nope")).toThrow();
  });
  it("parses channels", () => {
    expect(hexToRgb("#D7DBDE")).toEqual({ r: 215, g: 219, b: 222 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("rgbToOklch", () => {
  it("white is L≈1, C≈0", () => {
    const o = rgbToOklch({ r: 255, g: 255, b: 255 });
    expect(o.l).toBeCloseTo(1, 2);
    expect(o.c).toBeCloseTo(0, 3);
  });
  it("black is L≈0, C≈0", () => {
    const o = rgbToOklch({ r: 0, g: 0, b: 0 });
    expect(o.l).toBeCloseTo(0, 3);
    expect(o.c).toBeCloseTo(0, 3);
  });
  it("matches a known value for pure red (oklch ≈ 0.628 0.258 29.2)", () => {
    const o = rgbToOklch({ r: 255, g: 0, b: 0 });
    expect(o.l).toBeCloseTo(0.628, 2);
    expect(o.c).toBeCloseTo(0.258, 2);
    expect(o.h).toBeCloseTo(29.2, 0);
  });
  it("blue hue lands in the blue range", () => {
    const o = rgbToOklch({ r: 0, g: 0, b: 255 });
    expect(o.h).toBeGreaterThan(250);
    expect(o.h).toBeLessThan(290);
  });
});

describe("rgbToHsl / rgbToCmyk", () => {
  it("hsl of a mid grey is desaturated", () => {
    const { s } = rgbToHsl({ r: 128, g: 128, b: 128 });
    expect(s).toBe(0);
  });
  it("cmyk of black is K=100", () => {
    expect(rgbToCmyk({ r: 0, g: 0, b: 0 })).toEqual({ c: 0, m: 0, y: 0, k: 100 });
  });
  it("cmyk of white is all zero", () => {
    expect(rgbToCmyk({ r: 255, g: 255, b: 255 })).toEqual({ c: 0, m: 0, y: 0, k: 0 });
  });
});

describe("pickTextColor", () => {
  const opts = { light: "#FFFFFF", dark: "#141414" };
  it("dark text on a light swatch, light text on a dark swatch", () => {
    expect(pickTextColor("#ECF1F4", opts)).toBe("#141414");
    expect(pickTextColor("#171414", opts)).toBe("#FFFFFF");
  });
});

describe("formatField", () => {
  const color = { name: "Wet Grey", hex: "#d7dbde" };
  it("renders each field in its default style", () => {
    expect(formatField(color, "name")).toBe("Wet Grey");
    expect(formatField(color, "name", { uppercaseName: true })).toBe("WET GREY");
    expect(formatField(color, "hex")).toBe("#D7DBDE");
    expect(formatField(color, "rgb")).toBe("R:215,G:219,B:222");
    expect(formatField(color, "rgb", { rgbStyle: "css" })).toBe("rgb(215, 219, 222)");
    expect(formatField(color, "oklch")).toMatch(/^oklch\(\d+(\.\d+)?% [\d.]+ [\d.]+\)$/);
    expect(formatField(color, "oklch", { oklchStyle: "labeled" })).toMatch(/^L:.* C:.* H:.*/);
  });
});
