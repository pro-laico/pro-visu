import { defineConfig } from "pro-visu";
import { CAMEL, CURSOR, INK, LODEN, PAPER, VESPER } from "./showcase/brand";

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
    defaults: { "scroll-reel": { output: { width: 1280, height: 800, fps: 30 } } },
  },
  assets: [
    // The landing hero: auto-sections tuned to kill stop/start jitter (dsf 3 supersample) +
    // boomerang so the pan loops with no restart cut.
    {
      name: "docs-home",
      generator: "scroll-reel",
      options: {
        output: { width: 1280, height: 800, deviceScaleFactor: 3 },
        motion: { easing: "ease-in-out", loop: "boomerang", autoSections: { durationMs: 22000, holdMs: 1600 } },
        page: { waitForSelector: ".hero-media img" },
      },
    },
    // Actual scrolling: a clean auto-sections pan/hold down the home page.
    {
      name: "docs-scroll",
      generator: "scroll-reel",
      options: {
        page: { waitForSelector: ".hero-media img" },
        motion: { autoSections: { durationMs: 9000 } },
      },
    },
    // Straight loop: one auto-sections pass, then a glide back to the top so the clip loops.
    {
      name: "docs-straight",
      generator: "scroll-reel",
      options: {
        page: { waitForSelector: ".hero-media img" },
        motion: { loop: "straight", autoSections: { durationMs: 14000 } },
      },
    },
    // Scripted tour: phone viewport, eased scroll to "The Edit" module, then taps browse the
    // pieces — each tap crossfades the stage visual. Thumbs share a row, so no scroll between taps.
    {
      name: "docs-browse",
      generator: "interaction",
      url: "/shop",
      options: {
        output: { width: 390, height: 844, deviceScaleFactor: 2 },
        cursor: { color: CURSOR },
        page: { waitForSelector: "#edit-stage img" },
        actions: [
          { do: "scrollTo", to: "#edit", durationMs: 1200, holdMs: 800 },
          { do: "click", selector: ".edit-thumb:nth-child(2)", holdMs: 1600 },
          { do: "click", selector: ".edit-thumb:nth-child(3)", holdMs: 1600 },
          { do: "click", selector: ".edit-thumb:nth-child(4)", holdMs: 2000 },
        ],
      },
    },
    // Element focus: crop to the PDP buy box, trigger a size pick, hold — the crop is measured
    // after the trigger so the selected state stays in frame.
    {
      name: "docs-focus",
      generator: "interaction",
      url: "/products/the-camel-coat",
      options: {
        cursor: { color: CURSOR },
        page: { waitForSelector: ".mini-gallery img" },
        focus: {
          selector: ".addbag",
          padding: 32,
          actions: [{ do: "click", selector: ".size-options button:nth-of-type(4)" }],
          holdMs: 2500,
        },
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
        animation: { durationMs: 16_000 },
      },
    },
    { name: "docs-palette", generator: "palette", options: { colors: VESPER } },
    // Grid layout with per-corner fields and an embedded brand font.
    {
      name: "docs-palette-grid",
      generator: "palette",
      options: {
        colors: [
          { name: "Ink", hex: INK },
          { name: "Camel", hex: CAMEL },
          { name: "Paper", hex: PAPER },
          { name: "Loden", hex: LODEN },
        ],
        layout: { layout: "grid", gridColumns: 2 },
        fields: {
          topLeft: ["name"],
          topRight: ["hex"],
          bottomLeft: ["rgb"],
          bottomRight: ["oklch"],
        },
        text: { rgbStyle: "css", fontFile: "public/fonts/InterVariable.woff2", uppercase: true },
      },
    },
    // Desktop full page — the whole scrollable page, far taller than the viewport.
    {
      name: "docs-shot-desktop",
      generator: "screenshots",
      options: {
        viewports: [{ name: "desktop", width: 1440, height: 900 }],
        fullPage: true,
        page: { waitForSelector: ".hero-media img" },
      },
    },
    // Phone, above the fold only.
    {
      name: "docs-shot-mobile",
      generator: "screenshots",
      options: {
        viewports: [{ name: "mobile", width: 390, height: 844 }],
        fullPage: false,
        page: { waitForSelector: ".hero-media img" },
      },
    },
    // Element crop: the featured product card, shot at the desktop viewport.
    {
      name: "docs-shot",
      generator: "screenshots",
      url: "/shop",
      options: {
        viewports: [{ name: "desktop", width: 1440, height: 900 }],
        fullPage: false,
        elements: [{ selector: "#feature-card", name: "card" }],
        page: { waitForSelector: "#shop-grid .product img" },
      },
    },
    // A very simple real wall: 3 columns of photos as direct `{ src }` tiles (no producer
    // assets needed), one gentle drift, short.
    {
      name: "docs-wall",
      generator: "wall",
      options: {
        output: { width: 960, height: 540, fps: 30 },
        motion: { durationMs: 8000, loops: 1 },
        layout: { background: INK, gap: 4, cornerRadius: 4 },
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
        output: { width: 960, height: 540, fps: 30 },
        render: { capture: "realtime" },
        motion: { durationMs: 8000, loops: 1 },
        preview: { enabled: true },
        layout: { background: INK, gap: 4, cornerRadius: 4, tileAspect: 0.5625 }, // 9:16 phone clips
        columns: [
          { tiles: ["home", "pricing"], direction: "down" },
          { tiles: ["product", "lookbook"], direction: "up", stagger: 0.4 },
          { tiles: ["about", "contact"], direction: "down", stagger: 0.2 },
        ],
      },
    },
  ],
});
