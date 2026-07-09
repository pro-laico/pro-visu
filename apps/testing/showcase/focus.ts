import type { AssetSpecInput } from "pro-visu";

export const focusClips: AssetSpecInput[] = [
  { name: "hero", generator: "interaction", options: { focus: { selector: "#hero", padding: 0, holdMs: 2500 } } },
  { name: "editorial-card", generator: "interaction", options: { focus: { selector: "#editorial", holdMs: 2500 } } },
  {
    name: "card",
    generator: "interaction",
    options: {
      focus: { selector: "#feature-card", actions: [{ do: "click", selector: "#feature-card .quick-add" }] },
    },
  },
  { name: "lb-wordmark", generator: "interaction", url: "/lookbook", options: { focus: { selector: "#lb-wordmark", padding: 0, holdMs: 2500 } } },
  {
    name: "lb-editorial",
    generator: "interaction",
    url: "/lookbook",
    options: { page: { waitForSelector: "#lb-editorial img" }, focus: { selector: "#lb-editorial", padding: 0, holdMs: 2500 } },
  },
  { name: "lb-spec", generator: "interaction", url: "/lookbook", options: { focus: { selector: "#lb-spec-coat", padding: 0, holdMs: 2500 } } },
  { name: "lb-swatch", generator: "interaction", url: "/lookbook", options: { focus: { selector: "#lb-swatch", padding: 0, holdMs: 2500 } } },
  { name: "lb-quote", generator: "interaction", url: "/lookbook", options: { focus: { selector: "#lb-quote", padding: 0, holdMs: 2500 } } },
];
