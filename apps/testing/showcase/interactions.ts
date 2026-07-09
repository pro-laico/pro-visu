import type { AssetSpecInput } from "pro-visu";

import { CURSOR } from "./brand";

export const interactions: AssetSpecInput[] = [
  {
    name: "menu",
    generator: "interaction",
    options: {
      cursor: { color: CURSOR },
      setup: [{ do: "move", selector: "#menu-button", durationMs: 0, holdMs: 0 }],
      actions: [
        { do: "click", selector: "#menu-button", holdMs: 700 },
        { do: "hover", selector: "#menu-panel a", holdMs: 900 },
        { do: "move", selector: "#menu-button", durationMs: 500, holdMs: 250 },
        { do: "click", selector: "#menu-button", holdMs: 900 },
      ],
    },
  },
  {
    name: "cart",
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
    name: "browse",
    generator: "interaction",
    url: "/shop",
    options: {
      output: { width: 390, height: 844, deviceScaleFactor: 2 },
      cursor: { color: CURSOR },
      page: { waitForSelector: "#edit-stage img" },
      actions: [
        { do: "scrollTo", to: "#edit", durationMs: 1200, holdMs: 800 },
        { do: "click", selector: ".edit-thumb:nth-child(2)", holdMs: 1400 },
        { do: "click", selector: ".edit-thumb:nth-child(4)", holdMs: 1600 },
      ],
    },
  },
  {
    name: "buy",
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
  {
    name: "search",
    generator: "interaction",
    url: "/shop",
    options: {
      cursor: { color: CURSOR },
      page: { waitForSelector: "#search-input" },
      setup: [
        { do: "scrollTo", to: "#search-input", align: "top", offset: 40, durationMs: 0, holdMs: 0 },
        { do: "move", selector: "#search-input", durationMs: 0, holdMs: 0 },
      ],
      actions: [
        { do: "click", selector: "#search-input", holdMs: 500 },
        { do: "type", selector: "#search-input", text: "cashmere", delayMs: 60, easing: "ease-out", holdMs: 700 },
        { do: "press", key: "Enter", holdMs: 900 },
        { do: "click", selector: "#shop-grid .product:first-child .product-link", durationMs: 600, holdMs: 1400 },
      ],
    },
  },
];
