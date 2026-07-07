import type { AssetSpecInput } from "pro-visu";

// Storefront films: scroll-reels over the real pages.
export const films = [
  {
    name: "home", // auto-sections down the whole home page
    generator: "scroll-reel",
    options: {
      waitForSelector: ".hero-media img",
      autoSections: { durationMs: 14000 },
    },
  },
  {
    name: "home-vertical", // 9:16 social cut — mp4 for paid, gif + poster for organic
    generator: "scroll-reel",
    options: {
      width: 430,
      height: 932,
      deviceScaleFactor: 2,
      durationMs: 5000,
      aspect: "9:16",
      outputs: ["mp4", "gif", "poster"],
      waitForSelector: ".hero-media img",
    },
  },
  {
    name: "home-square", // 1:1 feed cut — mp4 + animated WebP (smaller than gif)
    generator: "scroll-reel",
    options: {
      width: 1080,
      height: 1080,
      deviceScaleFactor: 2,
      durationMs: 5000,
      aspect: "1:1",
      outputs: ["mp4", "webp"],
      waitForSelector: ".hero-media img",
    },
  },
  {
    name: "shop", // the collection page at two viewports; each emits its own asset
    generator: "scroll-reel",
    url: "/shop",
    options: {
      waitForSelector: ".product img",
      autoSections: { durationMs: 11000 },
      viewports: [
        { name: "desktop", width: 1440, height: 900 },
        { name: "tablet", width: 834, height: 1112 },
      ],
    },
  },
  {
    name: "product", // PDP: gallery → details → related
    generator: "scroll-reel",
    url: "/products/the-camel-coat",
    options: {
      waitForSelector: ".mini-gallery img",
      autoSections: { durationMs: 10000 },
    },
  },
  {
    name: "product-slip",
    generator: "scroll-reel",
    url: "/products/silk-slip-dress",
    options: {
      waitForSelector: ".mini-gallery img",
      autoSections: { durationMs: 10000 },
    },
  },
  {
    name: "about",
    generator: "scroll-reel",
    url: "/about",
    options: {
      waitForSelector: ".about-hero-media img",
      autoSections: { durationMs: 10000 },
    },
  },
  {
    name: "lookbook", // the brand board — a page built for capture (stable panel ids)
    generator: "scroll-reel",
    url: "/lookbook",
    options: {
      waitForSelector: "#lb-editorial img",
      autoSections: { durationMs: 11000 },
    },
  },
] satisfies AssetSpecInput[];
