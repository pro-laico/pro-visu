import type { AssetSpecInput } from "pro-visu";

// One reel stitched across the whole journey: home → shop → product → about.
export const tour = [
  {
    name: "tour",
    generator: "scroll-reel",
    options: {
      routes: [
        { url: "/", autoSections: { durationMs: 7000 } },
        { url: "/shop", autoSections: { durationMs: 6000 } },
        { url: "/products/the-camel-coat", autoSections: { durationMs: 6000 } },
        { url: "/about", autoSections: { durationMs: 6000 } },
      ],
    },
  },
] satisfies AssetSpecInput[];
