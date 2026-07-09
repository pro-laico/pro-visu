import type { AssetSpecInput, InteractionOptions } from "pro-visu";

import { INK } from "./brand";

const CLIP_VIEW: InteractionOptions = { output: { width: 390, height: 844, deviceScaleFactor: 2, fps: 30 }, cursor: { show: false } };

export const clips: AssetSpecInput[] = [
  {
    name: "clip-menu",
    url: "/",
    generator: "interaction",
    options: {
      ...CLIP_VIEW,
      page: { waitForSelector: ".hero-media img", startDelayMs: 1000, endDwellMs: 4100 },
      actions: [
        { do: "click", selector: "#menu-button", durationMs: 0, holdMs: 1600 },
        { do: "click", selector: "#menu-button", durationMs: 0, holdMs: 1300 },
      ],
    },
  },
  {
    name: "clip-wishlist",
    url: "/shop",
    generator: "interaction",
    options: {
      ...CLIP_VIEW,
      page: { waitForSelector: "#shop-grid .product img", startDelayMs: 0, endDwellMs: 3200 },
      actions: [
        { do: "hover", selector: "#shop-grid .product:nth-child(1) .product-media", durationMs: 0, holdMs: 2000 },
        { do: "click", selector: "#shop-grid .product:nth-child(1) .wishlist", durationMs: 0, holdMs: 1500 },
        { do: "click", selector: "#shop-grid .product:nth-child(1) .wishlist", durationMs: 0, holdMs: 1300 },
      ],
    },
  },
  {
    name: "clip-cart",
    url: "/products/the-camel-coat",
    generator: "interaction",
    options: {
      ...CLIP_VIEW,
      page: { waitForSelector: "#pdp-add", startDelayMs: 0, endDwellMs: 2000 },
      actions: [
        { do: "hover", selector: "#pdp-add", durationMs: 0, holdMs: 3000 },
        { do: "click", selector: "#pdp-add", durationMs: 0, holdMs: 4500 },
        { do: "click", selector: "#cart-drawer .drawer-close", durationMs: 0, holdMs: 2500 },
      ],
    },
  },
  {
    name: "clip-cart-trouser",
    url: "/products/pleated-wool-trouser",
    generator: "interaction",
    options: {
      ...CLIP_VIEW,
      page: { waitForSelector: "#pdp-add", startDelayMs: 0, endDwellMs: 1000 },
      actions: [
        { do: "hover", selector: "#pdp-add", durationMs: 0, holdMs: 4500 },
        { do: "click", selector: "#pdp-add", durationMs: 0, holdMs: 4000 },
        { do: "click", selector: "#cart-drawer .drawer-close", durationMs: 0, holdMs: 2500 },
      ],
    },
  },
  {
    name: "clip-size",
    url: "/products/silk-slip-dress",
    generator: "interaction",
    options: {
      ...CLIP_VIEW,
      page: { waitForSelector: "#pdp-add", startDelayMs: 0, endDwellMs: 0 },
      actions: [
        { do: "hover", selector: ".size-options", durationMs: 0, holdMs: 5400 },
        { do: "click", selector: ".size-options button:nth-of-type(4)", durationMs: 0, holdMs: 1400 },
        { do: "click", selector: ".size-options button:nth-of-type(3)", durationMs: 0, holdMs: 1200 },
      ],
    },
  },
  {
    name: "clip-wishlist-slip",
    url: "/shop",
    generator: "interaction",
    options: {
      ...CLIP_VIEW,
      page: { waitForSelector: "#shop-grid .product img", startDelayMs: 0, endDwellMs: 0 },
      actions: [
        { do: "hover", selector: "#shop-grid .product:nth-child(4) .product-media", durationMs: 0, holdMs: 5600 },
        { do: "click", selector: "#shop-grid .product:nth-child(4) .wishlist", durationMs: 0, holdMs: 1200 },
        { do: "click", selector: "#shop-grid .product:nth-child(4) .wishlist", durationMs: 0, holdMs: 1200 },
      ],
    },
  },
];

export const wallAssets: AssetSpecInput[] = [
  ...clips,
  {
    name: "lookbook-wall",
    generator: "wall",
    options: {
      output: { width: 1920, height: 1080, fps: 30, deviceScaleFactor: 2, crf: 18 },
      render: { capture: "frames" },
      layout: { background: INK, gap: 2, tileAspect: 0.75, cornerRadius: 0 },
      motion: { durationMs: 24_000, loops: 1 },
      columns: [
        { tiles: ["clip-cart", { src: "public/img/hero.jpg" }], direction: "down", stagger: 0.0 },
        { tiles: ["clip-menu", { src: "public/img/editorial.jpg" }], direction: "up", stagger: 0.42 },
        { tiles: ["clip-wishlist", { src: "public/img/about-atelier.jpg" }], direction: "down", stagger: 0.68 },
        { tiles: ["clip-size", { src: "public/img/products/leather-tote.jpg" }], direction: "up", stagger: 0.18 },
        { tiles: ["clip-cart-trouser", "clip-wishlist-slip"], direction: "down", stagger: 0.54 },
      ],
    },
  },
];
