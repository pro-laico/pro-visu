import type { AssetSpecInput } from "pro-visu";

// Storefront films: scroll-reels over the real pages.
export const films = [
  {
    name: "home", // auto-sections down the home page; straight loop glides back to the top at the end
    generator: "scroll-reel",
    options: {
      page: { waitForSelector: ".hero-media img" },
      motion: { loop: "straight", autoSections: { durationMs: 14000 } },
    },
  },
  {
    name: "home-vertical", // 9:16 social cut — mp4 for paid, gif + poster for organic
    generator: "scroll-reel",
    options: {
      output: { width: 430, height: 932, deviceScaleFactor: 2, outputs: ["mp4", "gif", "poster"] },
      motion: { durationMs: 5000 },
      reframe: { aspect: "9:16" },
      page: { waitForSelector: ".hero-media img" },
    },
  },
  {
    name: "home-square", // 1:1 feed cut — mp4 + animated WebP (smaller than gif)
    generator: "scroll-reel",
    options: {
      output: { width: 1080, height: 1080, deviceScaleFactor: 2, outputs: ["mp4", "webp"] },
      motion: { durationMs: 5000 },
      reframe: { aspect: "1:1" },
      page: { waitForSelector: ".hero-media img" },
    },
  },
  {
    name: "shop", // the collection page at two viewports; each emits its own asset
    generator: "scroll-reel",
    url: "/shop",
    options: {
      page: { waitForSelector: ".product img" },
      motion: { autoSections: { durationMs: 11000 } },
      variants: {
        viewports: [
          { name: "desktop", width: 1440, height: 900 },
          { name: "tablet", width: 834, height: 1112 },
        ],
      },
    },
  },
  {
    name: "product", // PDP: gallery → details → related
    generator: "scroll-reel",
    url: "/products/the-camel-coat",
    options: {
      page: { waitForSelector: ".mini-gallery img" },
      motion: { autoSections: { durationMs: 10000 } },
    },
  },
  {
    name: "product-slip",
    generator: "scroll-reel",
    url: "/products/silk-slip-dress",
    options: {
      page: { waitForSelector: ".mini-gallery img" },
      motion: { autoSections: { durationMs: 10000 } },
    },
  },
  {
    name: "about",
    generator: "scroll-reel",
    url: "/about",
    options: {
      page: { waitForSelector: ".about-hero-media img" },
      motion: { autoSections: { durationMs: 10000 } },
    },
  },
  {
    name: "lookbook", // the brand board — a page built for capture (stable panel ids)
    generator: "scroll-reel",
    url: "/lookbook",
    options: {
      page: { waitForSelector: "#lb-editorial img" },
      motion: { autoSections: { durationMs: 11000 } },
    },
  },
] satisfies AssetSpecInput[];
