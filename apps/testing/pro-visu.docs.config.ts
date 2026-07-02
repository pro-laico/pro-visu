import { defineConfig, type AssetSpecInput } from "pro-visu";

// ─────────────────────────────────────────────────────────────────────────────────────────────
// DOCS EXAMPLE ASSETS — generates the clips/stills embedded in the pro-visu docs (apps/docs) by
// dogfooding the VESPER storefront. Separate from the main showcase config (pro-visu.config.ts).
//
//   pnpm --filter testing exec pro-visu generate --config pro-visu.docs.config.ts
//
// Outputs land in public/pro-visu/ (gitignored). Curated files are then copied into:
//   • apps/docs/videos/         — videos → Mux via next-video (`pnpm --filter docs sync-videos`)
//   • apps/docs/public/examples/ — stills (png) served by next/image
// See apps/docs/videos.md for the full workflow. (The hero-loop / type-sans / colors-reel clips
// already on Mux come from the main config; they're not regenerated here.)
// ─────────────────────────────────────────────────────────────────────────────────────────────

const VESPER = [
  { name: "Ink", hex: "#1a1714" },
  { name: "Paper", hex: "#f6f3ed" },
  { name: "Camel", hex: "#b49a77" },
  { name: "Loden", hex: "#5c5e4c" },
  { name: "Cognac", hex: "#8a5a3c" },
];

// Real photos for the simple wall's tiles (image-passthrough producers).
const PHOTOS: AssetSpecInput[] = [
  { name: "img-coat", src: "public/img/products/the-camel-coat.jpg" },
  { name: "img-hero", src: "public/img/hero.jpg" },
  { name: "img-editorial", src: "public/img/editorial.jpg" },
  { name: "img-tote", src: "public/img/products/leather-tote.jpg" },
  { name: "img-slip", src: "public/img/products/silk-slip-dress.jpg" },
  { name: "img-atelier", src: "public/img/about-atelier.jpg" },
].map((t) => ({ name: t.name, generator: "image", options: { src: t.src } }));

export default defineConfig({
  settings: {
    outDir: "public/pro-visu",
    concurrency: 1,
    maxMemoryMB: 8192,
    browser: { headless: true },
    server: {
      build: "pnpm build",
      command: "pnpm exec next start",
      readyTimeoutMs: 180_000,
    },
    defaults: { "scroll-reel": { width: 1280, height: 800, fps: 30 } },
  },
  assets: [
    // ── scroll-reel: the landing hero — auto-sections (pause on each section, which we WANT), tuned
    //    to kill the stop/start jitter: heavy supersample (dsf 3) so the sub-pixel scroll crawl at each
    //    stop doesn't step, a gentle ease-in-out-sine (less time crawling at the stops than the default
    //    cubic), a frozen clock so the page's own animations can't add motion at the boundaries, and
    //    boomerang so the tour loops (down through the sections, then back up) with no restart cut. ──
    {
      name: "docs-home",
      generator: "scroll-reel",
      options: {
        width: 1280,
        height: 800,
        deviceScaleFactor: 3,
        easing: "ease-in-out-sine",
        loop: "boomerang",
        freezeClock: true,
        autoSections: { durationMs: 22000, holdMs: 1600 },
        waitForSelector: ".hero-media img",
      },
    },

    // ── scroll-reel: ACTUAL scrolling — a clean auto-sections pan/hold down the home page ──
    {
      name: "docs-scroll",
      generator: "scroll-reel",
      options: {
        waitForSelector: ".hero-media img",
        autoSections: { durationMs: 9000 },
      },
    },

    // ── scroll-reel: UI in a STATE — phone viewport, scripted cursor opens the menu and holds it ──
    {
      name: "docs-menu",
      generator: "scroll-reel",
      options: {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        cursor: { color: "#8c7355" },
        actions: [{ do: "click", selector: "#menu-button", holdMs: 2600 }],
      },
    },

    // ── specimen: the "demo" template on a serif (Fraunces) — a different template + font than
    //    the sweep/Inter example; capped so the labelled walkthrough reads without a 45s clip ──
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

    // ── palette: a still colour grid (png) ──
    { name: "docs-palette", generator: "palette", options: { colors: VESPER } },

    // ── screenshots: desktop FULL PAGE — the whole scrollable page, far taller than the viewport ──
    {
      name: "docs-shot-desktop",
      generator: "screenshots",
      options: {
        viewports: [{ name: "desktop", width: 1440, height: 900 }],
        fullPage: true,
        waitForSelector: ".hero-media img",
      },
    },

    // ── screenshots: phone, as normally seen (just the viewport, above the fold) ──
    {
      name: "docs-shot-mobile",
      generator: "screenshots",
      options: {
        viewports: [{ name: "mobile", width: 390, height: 844 }],
        fullPage: false,
        waitForSelector: ".hero-media img",
      },
    },

    // ── wall: a very simple REAL wall — 3 columns of photos, one gentle drift, short ──
    ...PHOTOS,
    {
      name: "docs-wall",
      generator: "wall",
      options: {
        width: 960,
        height: 540,
        fps: 30,
        durationMs: 8000,
        workers: 1,
        background: "#1a1714",
        gap: 4,
        cornerRadius: 4,
        loops: 1,
        columns: [
          { tiles: ["img-coat", "img-editorial"], direction: "down" },
          { tiles: ["img-hero", "img-tote"], direction: "up", stagger: 0.4 },
          { tiles: ["img-slip", "img-atelier"], direction: "down", stagger: 0.2 },
        ],
      },
    },

    // ── wall: TEST MODE — faux labelled boxes, recorded realtime, so it renders in seconds. The
    //    point of the example: when a wall composes lots of (slow) video tiles, iterate layout +
    //    motion in test mode first, then drop `test`/`realtime` for the real frame-stepped render ──
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
        background: "#1a1714",
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
