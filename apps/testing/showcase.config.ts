import { defineConfig } from "auto-showcase";

// The managed server (below) builds + starts this Next app on PORT, captures it, then stops it.
const PORT = 4310;
const URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  settings: {
    outDir: "public/showcase", // so the Next app serves assets at /showcase/* (and /gallery shows them)
    concurrency: 2,
    browser: { headless: true },
    server: {
      build: "pnpm build",
      command: `pnpm exec next start -p ${PORT}`,
      readyTimeoutMs: 180_000,
    },
    defaults: {
      "scroll-reel": { width: 1280, height: 800, fps: 30 },
    },
  },
  assets: [
    // motion: auto-detected sections + branded intro/outro cards + a timed caption
    {
      name: "home",
      url: URL,
      generator: "scroll-reel",
      options: {
        autoSections: { durationMs: 12000 },
        kenBurns: { scaleTo: 1.04 },
        intro: { title: "VESPER", subtitle: "Autumn / Winter 2026" },
        outro: { title: "Maison Vesper" },
        annotations: [{ text: "New Arrivals", atMs: 4000, untilMs: 7500, position: "top" }],
      },
    },
    // social vertical + multiple output formats
    {
      name: "home-vertical",
      url: URL,
      generator: "scroll-reel",
      options: {
        width: 430,
        height: 932,
        deviceScaleFactor: 2,
        duration: 5000,
        aspect: "9:16",
        outputs: ["mp4", "gif", "poster"],
      },
    },
    // responsive screenshots of the storefront
    {
      name: "shots",
      url: URL,
      generator: "screenshots",
      options: {
        breakpoints: [
          { name: "desktop", width: 1440, height: 900 },
          { name: "mobile", width: 390, height: 844 },
        ],
      },
    },
    // browser-window device frame
    { name: "frame", url: URL, generator: "device-frame", options: { frameWidth: 1280, background: "#1a1714" } },
    // scene: a phone-width capture composited into a phone mockup
    { name: "phone-cap", url: URL, generator: "scroll-reel", options: { width: 390, height: 844, duration: 5000 } },
    {
      name: "phone",
      generator: "scene",
      inputs: { screen: "phone-cap" },
      options: { scene: "phone", width: 1080, height: 1350, capture: "frames", durationSeconds: 6 },
    },
    // brand colour palette (no URL needed)
    {
      name: "colors",
      generator: "palette",
      options: {
        colors: [
          { name: "Ink", hex: "#1a1714" },
          { name: "Paper", hex: "#f6f3ed" },
          { name: "Camel", hex: "#b49a77" },
          { name: "Loden", hex: "#5c5e4c" },
          { name: "Cognac", hex: "#8a5a3c" },
        ],
      },
    },
    // scripted interaction: open the navigation mega-menu and hover a category
    {
      name: "menu",
      url: URL,
      generator: "scroll-reel",
      options: {
        cursor: { color: "#8c7355" },
        actions: [
          { do: "click", selector: "#menu-button" },
          { do: "hover", selector: "#menu-panel a" },
        ],
      },
    },
    // scripted interaction: add the featured piece to the bag, then open the cart drawer
    {
      name: "cart",
      url: URL,
      generator: "scroll-reel",
      options: {
        cursor: { color: "#8c7355" },
        actions: [
          { do: "click", selector: "#feature-card button" },
          { do: "click", selector: "#cart-button" },
        ],
      },
    },
    // element-focused clip: trigger the featured product card, crop to it
    {
      name: "card",
      url: URL,
      generator: "scroll-reel",
      options: {
        focus: { selector: "#feature-card", actions: [{ do: "click", selector: "#feature-card button" }] },
      },
    },
    // multi-page tour: home → collection → product detail
    { name: "tour", url: URL, generator: "scroll-reel", options: { routes: [URL, `${URL}/shop`, `${URL}/products/the-camel-coat`] } },
  ],
});
