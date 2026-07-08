import type { AssetSpecInput } from "pro-visu";
import { CAMEL, COGNAC, INK, PAPER, FASHION } from "./brand";

// Colour + type pieces (no URL needed).
export const brandAssets: AssetSpecInput[] = [
  { name: "colors", generator: "palette", options: { colors: FASHION } },
  {
    name: "colors-reel", // the same palette as a looping reveal video
    generator: "palette-reel",
    options: {
      colors: FASHION,
      details: ["hex", "oklch"],
      text: { uppercase: true },
      layout: { background: INK },
      contrast: { textLight: PAPER },
    },
  },

  // Type specimens: three width-stable glyph walls across sans / serif / mono.
  {
    name: "type-sans", // the "sweep" preset: a seamless dark loop of even per-glyph colour sweeps
    generator: "specimen",
    options: {
      font: "public/fonts/InterVariable.woff2",
      name: "Inter",
      template: "sweep",
      type: { lines: 4 },
    },
  },
  {
    name: "type-serif", // custom editorial storyboard on the paper palette, name tucked bottom-left in cognac
    generator: "specimen",
    options: {
      font: "public/fonts/Fraunces.woff2",
      name: "Fraunces",
      type: { lines: 3, weight: 500 },
      animation: { demo: true },
      colors: { background: PAPER, foreground: INK, muted: CAMEL, accent: COGNAC },
      label: { anchor: "bottom-left", padding: 2, size: 0.26, weight: 600, color: COGNAC },
      pulses: [
        { name: "rest", durationMs: 1200 },
        { name: "set", durationMs: 1600, chars: 0.5, pacing: "ease-in-out" },
        { name: "to camel", durationMs: 1400, colors: 1, color: "muted", pacing: "ease-out" },
        { name: "cognac pops", durationMs: 1000, colors: 0.35, color: "accent", pacing: "random" },
        { name: "to ink", durationMs: 1400, colors: 1, color: "foreground", pacing: "ease-in" },
        { name: "settle", durationMs: 800 },
      ],
    },
  },
  {
    name: "type-mono", // terminal-green storyboard; uniform glyph widths render as a perfect grid
    generator: "specimen",
    options: {
      font: "public/fonts/JetBrainsMono.woff2",
      name: "JetBrains Mono",
      type: { lines: 6, weight: 500 },
      colors: { background: "#0b0f10", foreground: "#cdd6d3", muted: "#586460", accent: "#6ee7a8" },
      pulses: [
        { name: "idle", durationMs: 1000 },
        { name: "type", durationMs: 1600, chars: 0.5, pacing: "ease-out" },
        { name: "accent", durationMs: 1000, colors: 0.3, color: "accent", pacing: "random" },
        { name: "type", durationMs: 1400, chars: 0.4, pacing: "ease-in" },
        { name: "dim", durationMs: 1200, colors: 0.5, color: "muted", pacing: "ease-in-out" },
        { name: "rest", durationMs: 800 },
      ],
    },
  },
];
