/**
 * Pure color math for the palette generator: hex parsing and conversions to RGB / OKLCH / HSL /
 * CMYK, a relative-luminance contrast pick (dark-vs-light text on a swatch), and per-field label
 * formatting. No I/O — fully unit-testable.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** A field that can be shown on a swatch. */
export type FieldId = "name" | "hex" | "rgb" | "oklch" | "hsl" | "cmyk";

/** Normalize `#rgb` / `rgb` / `#rrggbb` (any case) to canonical uppercase `#RRGGBB`. */
export function normalizeHex(hex: string): string {
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Invalid hex color: "${hex}"`);
  return `#${h.toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** sRGB channel (0..1) → linear-light. */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export interface Oklch {
  /** Lightness 0..1. */
  l: number;
  /** Chroma (~0..0.4). */
  c: number;
  /** Hue degrees 0..360. */
  h: number;
}

/**
 * sRGB (0..255) → OKLCH, via Björn Ottosson's OKLab matrices. Returns L in [0,1], C ≥ 0, H in
 * [0,360). Hue is undefined for greys (C≈0) — reported as 0.
 */
export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);

  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.hypot(a, bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { l: clamp(L, 0, 1), c: C, h: C < 1e-4 ? 0 : H };
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** sRGB (0..255) → HSL (h 0..360, s/l 0..100). */
export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6;
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export interface Cmyk {
  c: number;
  m: number;
  y: number;
  k: number;
}

/** sRGB (0..255) → CMYK percentages (naive, profile-less). */
export function rgbToCmyk({ r, g, b }: Rgb): Cmyk {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k >= 1 - 1e-9) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - rn - k) / (1 - k)) * 100),
    m: Math.round(((1 - gn - k) / (1 - k)) * 100),
    y: Math.round(((1 - bn - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

/** WCAG relative luminance (0..1) of an sRGB color. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * srgbToLinear(r / 255) +
    0.7152 * srgbToLinear(g / 255) +
    0.0722 * srgbToLinear(b / 255)
  );
}

/** Pick readable text on a swatch: the dark text on light backgrounds, light text on dark ones. */
export function pickTextColor(
  hex: string,
  opts: { light: string; dark: string; threshold?: number },
): string {
  const lum = relativeLuminance(hexToRgb(hex));
  return lum > (opts.threshold ?? 0.5) ? opts.dark : opts.light;
}

export interface FieldFormat {
  uppercaseName?: boolean;
  /** "labeled" → R:..,G:..,B:..  ·  "css" → rgb(.. .. ..)  ·  "plain" → ".. .. .." */
  rgbStyle?: "labeled" | "css" | "plain";
  /** "css" → oklch(88% 0.012 250)  ·  "labeled" → L:88% C:0.012 H:250 */
  oklchStyle?: "css" | "labeled";
}

const round = (n: number, d = 0): number => {
  const p = 10 ** d;
  return Math.round(n * p) / p;
};

/** Render one field of a color as its display string. */
export function formatField(
  color: { name: string; hex: string },
  field: FieldId,
  fmt: FieldFormat = {},
): string {
  const hex = normalizeHex(color.hex);
  const rgb = hexToRgb(hex);
  switch (field) {
    case "name":
      return fmt.uppercaseName ? color.name.toUpperCase() : color.name;
    case "hex":
      return hex;
    case "rgb": {
      const { r, g, b } = rgb;
      if (fmt.rgbStyle === "css") return `rgb(${r}, ${g}, ${b})`;
      if (fmt.rgbStyle === "plain") return `${r} ${g} ${b}`;
      return `R:${r},G:${g},B:${b}`;
    }
    case "oklch": {
      const { l, c, h } = rgbToOklch(rgb);
      const L = `${round(l * 100)}%`;
      const C = round(c, 3);
      const H = round(h, 1);
      return fmt.oklchStyle === "labeled" ? `L:${L} C:${C} H:${H}` : `oklch(${L} ${C} ${H})`;
    }
    case "hsl": {
      const { h, s, l } = rgbToHsl(rgb);
      return `H:${h},S:${s},L:${l}`;
    }
    case "cmyk": {
      const { c, m, y, k } = rgbToCmyk(rgb);
      return `C:${c},M:${m},Y:${y},K:${k}`;
    }
  }
}
