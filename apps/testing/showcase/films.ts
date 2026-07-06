import { defineAssets } from "pro-visu";
import { INK, PAPER } from "./brand";

// Storefront films: scroll-reels over the real pages, plus a seamless hero loop.
export const films = defineAssets([
  {
    name: "home", // auto-sections + slow Ken Burns, branded cards, spotlight + ring annotations
    generator: "scroll-reel",
    options: {
      waitForSelector: ".hero-media img",
      autoSections: { durationMs: 14000 },
      kenBurns: { scaleTo: 1.05, originY: 0.35 },
      intro: { title: "VESPER", subtitle: "Autumn / Winter 2026", background: INK, color: PAPER },
      outro: { title: "Maison Vesper", subtitle: "Quietly made in Europe", background: INK, color: PAPER },
      annotations: [
        { spotlight: "#hero", text: "Quiet luxury, considered", atMs: 600, untilMs: 4000, position: "bottom" },
        { ring: "#feature-card", text: "The Autumn Edit", atMs: 5000, untilMs: 8500, position: "top" },
      ],
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
    name: "product", // PDP: gallery → details → related, ring on the add-to-bag CTA
    generator: "scroll-reel",
    url: "/products/the-camel-coat",
    options: {
      waitForSelector: ".mini-gallery img",
      autoSections: { durationMs: 10000 },
      annotations: [{ ring: "#pdp-add", text: "Add to bag", atMs: 2500, untilMs: 5500, position: "bottom" }],
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
      kenBurns: { scaleTo: 1.04 },
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
  {
    name: "hero-loop", // drop-in looping hero bg: held beat + boomeranged Ken Burns, no seam
    generator: "scroll-reel",
    options: {
      durationMs: 4000,
      loop: "boomerang",
      startDelayMs: 0,
      endDwellMs: 0,
      kenBurns: { scaleTo: 1.05, originY: 0.4 },
      choreography: [{ to: "0%", durationMs: 4000, holdMs: 0 }],
      waitForSelector: ".hero-media img",
    },
  },
]);
