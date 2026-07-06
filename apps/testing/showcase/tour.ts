import { defineAssets } from "pro-visu";
import { INK, PAPER } from "./brand";

// One reel stitched across the whole journey: home → shop → product → about.
export const tour = defineAssets([
  {
    name: "tour",
    generator: "scroll-reel",
    options: {
      intro: { title: "VESPER", subtitle: "A walk through the house", background: INK, color: PAPER },
      routes: [
        { url: "/", autoSections: { durationMs: 7000 } },
        { url: "/shop", autoSections: { durationMs: 6000 } },
        { url: "/products/the-camel-coat", autoSections: { durationMs: 6000 } },
        { url: "/about", autoSections: { durationMs: 6000 } },
      ],
    },
  },
]);
