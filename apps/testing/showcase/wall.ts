import type { AssetSpecInput, InteractionOptions } from "pro-visu";
import { INK } from "./brand";

// The media wall and its tile producers: a quiet grid of mobile phone screens — most tiles sit
// still, now and then one does a single thing (a drawer slides in, a heart fills). Clip lengths
// (8s / 12s) divide the 24s wall so every tile loops cleanly. Full-res photo accents ride in as
// direct `{ src }` tiles on the wall itself — no producer assets needed.

// Shared clip recipe: 390×844 phone viewport, cursor hidden. Each clip is authored as
// hold still → one interaction (held well past a second) → settle back to rest, so the loop is
// seamless; startDelayMs + endDwellMs + Σ(durationMs + holdMs) sums to the clip length.
const CLIP_VIEW: InteractionOptions = { width: 390, height: 844, deviceScaleFactor: 2, fps: 30, cursor: { show: false } };

// Six distinct clips (no tile reused → no synchronised "twins"), staggered action windows +
// mixed lengths so the wall never goes "all still then all active" at once.
export const clips = [
  {
    name: "clip-menu", // home: open the mega-menu, close it (acts early) — 8s
    url: "/",
    generator: "interaction",
    options: {
      ...CLIP_VIEW,
      waitForSelector: ".hero-media img",
      startDelayMs: 1000,
      endDwellMs: 4100,
      actions: [
        { do: "click", selector: "#menu-button", durationMs: 0, holdMs: 1600 },
        { do: "click", selector: "#menu-button", durationMs: 0, holdMs: 1300 },
      ],
    },
  },
  {
    name: "clip-wishlist", // shop: heart the coat, unheart it — 8s
    url: "/shop",
    generator: "interaction",
    options: {
      ...CLIP_VIEW,
      waitForSelector: "#shop-grid .product img",
      startDelayMs: 0,
      endDwellMs: 3200,
      actions: [
        { do: "hover", selector: "#shop-grid .product:nth-child(1) .product-media", durationMs: 0, holdMs: 2000 },
        { do: "click", selector: "#shop-grid .product:nth-child(1) .wishlist", durationMs: 0, holdMs: 1500 },
        { do: "click", selector: "#shop-grid .product:nth-child(1) .wishlist", durationMs: 0, holdMs: 1300 },
      ],
    },
  },
  {
    name: "clip-cart", // PDP coat: add to bag, drawer held open ~4s, close — 12s
    url: "/products/the-camel-coat",
    generator: "interaction",
    options: {
      ...CLIP_VIEW,
      waitForSelector: "#pdp-add",
      startDelayMs: 0,
      endDwellMs: 2000,
      actions: [
        { do: "hover", selector: "#pdp-add", durationMs: 0, holdMs: 3000 },
        { do: "click", selector: "#pdp-add", durationMs: 0, holdMs: 4500 },
        { do: "click", selector: "#cart-drawer .drawer-close", durationMs: 0, holdMs: 2500 },
      ],
    },
  },
  {
    name: "clip-cart-trouser", // PDP trouser: same flow, different bag, acts later — 12s
    url: "/products/pleated-wool-trouser",
    generator: "interaction",
    options: {
      ...CLIP_VIEW,
      waitForSelector: "#pdp-add",
      startDelayMs: 0,
      endDwellMs: 1000,
      actions: [
        { do: "hover", selector: "#pdp-add", durationMs: 0, holdMs: 4500 },
        { do: "click", selector: "#pdp-add", durationMs: 0, holdMs: 4000 },
        { do: "click", selector: "#cart-drawer .drawer-close", durationMs: 0, holdMs: 2500 },
      ],
    },
  },
  {
    name: "clip-size", // PDP slip: pick size L, back to M (acts late) — 8s
    url: "/products/silk-slip-dress",
    generator: "interaction",
    options: {
      ...CLIP_VIEW,
      waitForSelector: "#pdp-add",
      startDelayMs: 0,
      endDwellMs: 0,
      actions: [
        { do: "hover", selector: ".size-options", durationMs: 0, holdMs: 5400 },
        { do: "click", selector: ".size-options button:nth-of-type(4)", durationMs: 0, holdMs: 1400 },
        { do: "click", selector: ".size-options button:nth-of-type(3)", durationMs: 0, holdMs: 1200 },
      ],
    },
  },
  {
    name: "clip-wishlist-slip", // shop: heart the slip — 8s
    url: "/shop",
    generator: "interaction",
    options: {
      ...CLIP_VIEW,
      waitForSelector: "#shop-grid .product img",
      startDelayMs: 0,
      endDwellMs: 0,
      actions: [
        { do: "hover", selector: "#shop-grid .product:nth-child(4) .product-media", durationMs: 0, holdMs: 5600 },
        { do: "click", selector: "#shop-grid .product:nth-child(4) .wishlist", durationMs: 0, holdMs: 1200 },
        { do: "click", selector: "#shop-grid .product:nth-child(4) .wishlist", durationMs: 0, holdMs: 1200 },
      ],
    },
  },
] satisfies AssetSpecInput[];

export const wallAssets = [
  ...clips,
  {
    name: "lookbook-wall",
    generator: "wall",
    // Each column lists its tiles: clip assets by name (the wall derives its dependencies) and
    // full-res photos as direct { src } files. 5 columns × 2 tiles.
    options: {
      width: 1920,
      height: 1080,
      fps: 30,
      capture: "frames", // frame-exact + crisp; for fast layout iteration set test: true + "realtime"
      deviceScaleFactor: 2,
      crf: 18,
      durationMs: 24_000, // multiple of the 8s/12s tile clips, so every tile loops cleanly
      background: INK,
      gap: 2,
      tileAspect: 0.75,
      cornerRadius: 0,
      // Quiet motion: each column does ONE gentle seamless drift over the 24s, neighbours
      // alternating up/down with spread staggers. No X pan, no pulses.
      loops: 1,
      columns: [
        { tiles: ["clip-cart", { src: "public/img/hero.jpg" }], direction: "down", stagger: 0.0 },
        { tiles: ["clip-menu", { src: "public/img/editorial.jpg" }], direction: "up", stagger: 0.42 },
        { tiles: ["clip-wishlist", { src: "public/img/about-atelier.jpg" }], direction: "down", stagger: 0.68 },
        { tiles: ["clip-size", { src: "public/img/products/leather-tote.jpg" }], direction: "up", stagger: 0.18 },
        { tiles: ["clip-cart-trouser", "clip-wishlist-slip"], direction: "down", stagger: 0.54 },
      ],
    },
  },
] satisfies AssetSpecInput[];
