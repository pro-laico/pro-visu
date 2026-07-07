import type { AssetSpecInput } from "pro-visu";
import { CURSOR } from "./brand";

// Scripted realtime tours with the synthetic cursor — slow + deliberate, in camel.
export const interactions = [
  {
    name: "menu", // open the mega-menu, glide across a category link
    generator: "interaction",
    options: {
      cursor: { color: CURSOR },
      actions: [
        { do: "click", selector: "#menu-button", holdMs: 700 },
        { do: "hover", selector: "#menu-panel a", holdMs: 900 },
        { do: "wait", holdMs: 600 },
      ],
    },
  },
  {
    name: "cart", // quick-add the featured piece, open the cart drawer
    generator: "interaction",
    options: {
      cursor: { color: CURSOR },
      actions: [
        { do: "click", selector: "#feature-card .quick-add", holdMs: 700 },
        { do: "click", selector: "#cart-button", holdMs: 1200 },
      ],
    },
  },
  {
    name: "buy", // PDP buy flow: choose a size, add to bag, drawer slides in
    generator: "interaction",
    url: "/products/the-camel-coat",
    options: {
      cursor: { color: CURSOR },
      actions: [
        { do: "click", selector: ".size-options button:nth-of-type(4)", holdMs: 600 },
        { do: "click", selector: "#pdp-add", holdMs: 1400 },
      ],
    },
  },
] satisfies AssetSpecInput[];
