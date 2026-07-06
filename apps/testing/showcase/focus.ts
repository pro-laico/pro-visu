import { defineAssets } from "pro-visu";

// Element-focused clips: scroll one component into view, hold, crop to its box.
// The lb-* tiles crop the /lookbook brand board's stable-id 3:4 panels — they double as
// standalone editorial tiles and extra wall tiles.
export const focusClips = defineAssets([
  { name: "hero", generator: "scroll-reel", options: { focus: { selector: "#hero", padding: 0, holdMs: 2500 } } },
  { name: "editorial-card", generator: "scroll-reel", options: { focus: { selector: "#editorial", holdMs: 2500 } } },
  {
    name: "card", // the featured product card — trigger its quick-add, then crop to the card
    generator: "scroll-reel",
    options: {
      focus: { selector: "#feature-card", actions: [{ do: "click", selector: "#feature-card .quick-add" }] },
    },
  },
  { name: "lb-wordmark", generator: "scroll-reel", url: "/lookbook", options: { focus: { selector: "#lb-wordmark", padding: 0, holdMs: 2500 } } },
  {
    name: "lb-editorial",
    generator: "scroll-reel",
    url: "/lookbook",
    options: { waitForSelector: "#lb-editorial img", focus: { selector: "#lb-editorial", padding: 0, holdMs: 2500 } },
  },
  { name: "lb-spec", generator: "scroll-reel", url: "/lookbook", options: { focus: { selector: "#lb-spec-coat", padding: 0, holdMs: 2500 } } },
  { name: "lb-swatch", generator: "scroll-reel", url: "/lookbook", options: { focus: { selector: "#lb-swatch", padding: 0, holdMs: 2500 } } },
  { name: "lb-quote", generator: "scroll-reel", url: "/lookbook", options: { focus: { selector: "#lb-quote", padding: 0, holdMs: 2500 } } },
]);
