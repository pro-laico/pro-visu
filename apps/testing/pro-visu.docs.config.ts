import { defineConfig } from "pro-visu";
import { CURSOR, INK, VESPER } from "./showcase/brand";

// DOCS EXAMPLE ASSETS — the clips/stills embedded in the pro-visu docs (apps/docs), dogfooding
// the VESPER storefront. Separate from the main showcase config (pro-visu.config.ts).
//
//   pnpm --filter testing exec pro-visu generate --config pro-visu.docs.config.ts
//
// Outputs land in public/pro-visu/ (gitignored); curated files are copied into apps/docs/videos/
// (→ Mux via `pnpm --filter docs sync-videos`) and apps/docs/public/examples/ (stills). See
// apps/docs/videos.md for the workflow. The hero-loop / type-sans / colors-reel clips already on
// Mux come from the main config and aren't regenerated here.

export default defineConfig({
  settings: {
    outDir: "public/pro-visu",
    concurrency: 1,
    browser: { headless: true },
    server: {
      build: "pnpm build",
      command: "pnpm exec next start",
      readyTimeoutMs: 180_000,
    },
    // Freeze time/randomness so every docs capture is perfectly repeatable.
    capture: { freezeClock: true },
    defaults: { "scroll-reel": { width: 1280, height: 800, fps: 30 } },
  },
  assets: [
    // The landing hero: auto-sections tuned to kill stop/start jitter (dsf 3 supersample) +
    // boomerang so the pan loops with no restart cut.
    {
      name: "docs-home",
      generator: "scroll-reel",
      options: {
        width: 1280,
        height: 800,
        deviceScaleFactor: 3,
        easing: "ease-in-out",
        loop: "boomerang",
        autoSections: { durationMs: 22000, holdMs: 1600 },
        waitForSelector: ".hero-media img",
      },
    },
    // Actual scrolling: a clean auto-sections pan/hold down the home page.
    {
      name: "docs-scroll",
      generator: "scroll-reel",
      options: {
        waitForSelector: ".hero-media img",
        autoSections: { durationMs: 9000 },
      },
    },
    // UI in a state: phone viewport, scripted cursor opens the menu and holds it.
    {
      name: "docs-menu",
      generator: "interaction",
      options: {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        cursor: { color: CURSOR },
        actions: [{ do: "click", selector: "#menu-button", holdMs: 2600 }],
      },
    },
    // The "demo" specimen template on a serif — capped so the labelled walkthrough stays short.
    {
      name: "docs-type-demo",
      generator: "specimen",
      options: {
        font: "public/fonts/Fraunces.woff2",
        name: "Fraunces",
        template: "demo",
        durationMs: 16_000,
      },
    },
    { name: "docs-palette", generator: "palette", options: { colors: VESPER } },
    // Desktop full page — the whole scrollable page, far taller than the viewport.
    {
      name: "docs-shot-desktop",
      generator: "screenshots",
      options: {
        viewports: [{ name: "desktop", width: 1440, height: 900 }],
        fullPage: true,
        waitForSelector: ".hero-media img",
      },
    },
    // Phone, above the fold only.
    {
      name: "docs-shot-mobile",
      generator: "screenshots",
      options: {
        viewports: [{ name: "mobile", width: 390, height: 844 }],
        fullPage: false,
        waitForSelector: ".hero-media img",
      },
    },
    // A very simple real wall: 3 columns of photos as direct `{ src }` tiles (no producer
    // assets needed), one gentle drift, short.
    {
      name: "docs-wall",
      generator: "wall",
      options: {
        width: 960,
        height: 540,
        fps: 30,
        durationMs: 8000,
        background: INK,
        gap: 4,
        cornerRadius: 4,
        loops: 1,
        columns: [
          {
            tiles: [{ src: "public/img/products/the-camel-coat.jpg" }, { src: "public/img/editorial.jpg" }],
            direction: "down",
          },
          {
            tiles: [{ src: "public/img/hero.jpg" }, { src: "public/img/products/leather-tote.jpg" }],
            direction: "up",
            stagger: 0.4,
          },
          {
            tiles: [{ src: "public/img/products/silk-slip-dress.jpg" }, { src: "public/img/about-atelier.jpg" }],
            direction: "down",
            stagger: 0.2,
          },
        ],
      },
    },
    // Wall TEST MODE: faux labelled boxes recorded realtime — the docs example for iterating
    // layout + motion in seconds before the real frame-stepped render.
    {
      name: "docs-wall-test",
      generator: "wall",
      options: {
        width: 960,
        height: 540,
        fps: 30,
        durationMs: 8000,
        capture: "realtime",
        test: true,
        background: INK,
        gap: 4,
        cornerRadius: 4,
        tileAspect: 0.5625, // 9:16 phone clips
        loops: 1,
        columns: [
          { tiles: ["home", "pricing"], direction: "down" },
          { tiles: ["product", "lookbook"], direction: "up", stagger: 0.4 },
          { tiles: ["about", "contact"], direction: "down", stagger: 0.2 },
        ],
      },
    },
  ],
});
