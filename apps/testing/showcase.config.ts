import { defineConfig } from "auto-showcase";

// No port/url plumbing: with a managed server the tool injects PORT into the command and treats
// the server's URL as the default base — assets omit `url` (capture the root) and routes use
// relative paths.
export default defineConfig({
  settings: {
    outDir: "public/showcase", // so the Next app serves assets at /showcase/* (and /gallery shows them)
    concurrency: 2,
    browser: { headless: true },
    server: {
      build: "pnpm build",
      command: "pnpm exec next start", // tool sets PORT (defaults to 3101); Next binds it
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
      generator: "screenshots",
      options: {
        breakpoints: [
          { name: "desktop", width: 1440, height: 900 },
          { name: "mobile", width: 390, height: 844 },
        ],
      },
    },
    // scene: a phone-width capture composited into a phone mockup
    { name: "phone-cap", generator: "scroll-reel", options: { width: 390, height: 844, duration: 5000 } },
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
    // type specimens: three width-stable glyph walls across sans / serif / mono (no URL needed)
    // 1) sans — the "sweep" preset: a seamless dark loop of even per-glyph colour sweeps
    {
      name: "type-sans",
      generator: "specimen",
      options: {
        font: "public/fonts/InterVariable.woff2",
        name: "Inter",
        template: "sweep",
        lines: 4,
      },
    },
    // 2) serif — a custom editorial storyboard on the VESPER paper palette, with the pulse labels on
    {
      name: "type-serif",
      generator: "specimen",
      options: {
        font: "public/fonts/Fraunces.woff2",
        name: "Fraunces",
        demo: true,
        lines: 3,
        weight: 480,
        colors: { background: "#f6f3ed", foreground: "#1a1714", muted: "#b49a77", accent: "#8a5a3c" },
        pulses: [
          { name: "rest", duration: 1.2 },
          { name: "set", duration: 1.6, chars: 0.5, pacing: "ease-in-out" },
          { name: "to camel", duration: 1.4, colors: 1, color: "muted", pacing: "ease-out" },
          { name: "cognac pops", duration: 1.0, colors: 0.35, color: "accent", pacing: "random" },
          { name: "to ink", duration: 1.4, colors: 1, color: "foreground", pacing: "ease-in" },
          { name: "settle", duration: 0.8 },
        ],
      },
    },
    // 3) mono — a custom terminal-green storyboard; uniform glyph widths render as a perfect grid
    {
      name: "type-mono",
      generator: "specimen",
      options: {
        font: "public/fonts/JetBrainsMono.woff2",
        name: "JetBrains Mono",
        lines: 6,
        weight: 500,
        colors: { background: "#0b0f10", foreground: "#cdd6d3", muted: "#586460", accent: "#6ee7a8" },
        pulses: [
          { name: "idle", duration: 1.0 },
          { name: "type", duration: 1.6, chars: 0.5, pacing: "ease-out" },
          { name: "accent", duration: 1.0, colors: 0.3, color: "accent", pacing: "random" },
          { name: "type", duration: 1.4, chars: 0.4, pacing: "ease-in" },
          { name: "dim", duration: 1.2, colors: 0.5, color: "muted", pacing: "ease-in-out" },
          { name: "rest", duration: 0.8 },
        ],
      },
    },
    // scripted interaction: open the navigation mega-menu and hover a category
    {
      name: "menu",
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
      generator: "scroll-reel",
      options: {
        focus: { selector: "#feature-card", actions: [{ do: "click", selector: "#feature-card button" }] },
      },
    },
    // multi-page tour: home → collection → product detail (relative paths, resolved against the server)
    { name: "tour", generator: "scroll-reel", options: { routes: ["/", "/shop", "/products/the-camel-coat"] } },
  ],
});
