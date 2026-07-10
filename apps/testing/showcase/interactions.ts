import type { AssetSpecInput } from "pro-visu";

import { CURSOR } from "./brand";

export const interactions: AssetSpecInput[] = [
  {
    name: "menu",
    generator: "interaction",
    options: {
      cursor: { color: CURSOR },
      setup: [{ do: "move", selector: "#menu-button", durationMs: 0 }],
      actions: [
        { do: "click", selector: "#menu-button" },
        { do: "wait", durationMs: 700 },
        { do: "hover", selector: "#menu-panel a" },
        { do: "wait", durationMs: 900 },
        { do: "move", selector: "#menu-button", durationMs: 500 },
        { do: "wait", durationMs: 250 },
        { do: "click", selector: "#menu-button" },
        { do: "wait", durationMs: 900 },
      ],
    },
  },
  {
    name: "cart",
    generator: "interaction",
    options: {
      cursor: { color: CURSOR },
      actions: [
        { do: "click", selector: "#feature-card .quick-add" },
        { do: "wait", durationMs: 700 },
        { do: "click", selector: "#cart-button" },
        { do: "wait", durationMs: 1200 },
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
        { do: "scrollTo", to: "#edit", durationMs: 1200 },
        { do: "wait", durationMs: 800 },
        { do: "click", selector: ".edit-thumb:nth-child(2)" },
        { do: "wait", durationMs: 1400 },
        { do: "click", selector: ".edit-thumb:nth-child(4)" },
        { do: "wait", durationMs: 1600 },
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
        { do: "click", selector: ".size-options button:nth-of-type(4)" },
        { do: "wait", durationMs: 600 },
        { do: "click", selector: "#pdp-add" },
        { do: "wait", durationMs: 1400 },
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
        { do: "scrollTo", to: "#search-input", align: "top", offset: 40, durationMs: 0 },
        { do: "move", selector: "#search-input", durationMs: 0 },
      ],
      actions: [
        { do: "click", selector: "#search-input" },
        { do: "wait", durationMs: 500 },
        { do: "type", selector: "#search-input", text: "cashmere", delayMs: 60, easing: "ease-out" },
        { do: "wait", durationMs: 700 },
        { do: "press", key: "Enter" },
        { do: "wait", durationMs: 900 },
        { do: "click", selector: "#shop-grid .product:first-child .product-link", durationMs: 600 },
        { do: "wait", durationMs: 1400 },
      ],
    },
  },
];
