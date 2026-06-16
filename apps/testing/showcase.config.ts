import { defineConfig } from "auto-showcase";

// An expansive showcase for the VESPER storefront — now that the site ships real on-model
// photography (hero, editorial, about, and a photo per product), the config tours every
// surface and exercises every generator/feature.
//
// Server plumbing: with a managed server the tool injects PORT into the command and treats the
// server's URL as the default base. URL-based assets omit `url` to capture the root (home), or
// set a relative `url` (e.g. "/shop") that resolves against the server; local generators
// (palette, palette-reel, specimen, scene) need no url at all.
// ════════════════════════════════════════════════════════════════════════════════════════
// FEEL — "Quiet & slow" (the authoring guideline for every asset)
//  • Pace: unhurried. Target every clip at ~10s. Hold long on each section; never rush a scroll.
//  • Easing: gentle (easeInOutSine / easeOutCubic). No linear, no snap.
//  • Motion: at most a whisper of Ken Burns (scaleTo ≤ 1.04). Let the photography sit still.
//  • Captions/cards: minimal — ideally none while we set the tone. If used: restrained, in the
//    brand voice ("quietly made"), never salesy.
//  • Palette: Ink #1a1714 · Paper #f6f3ed · Camel #b49a77 · Loden #5c5e4c · Cognac #8a5a3c.
//    Cards/backdrops = ink bg + paper text. Cursor (interactions) = camel #8c7355, slow + deliberate.
//  • Respect negative space; no clutter, no UI chrome we don't mean to show.
// ════════════════════════════════════════════════════════════════════════════════════════
// Media-wall tile producers (build order step 2: pipeline proof). Each product photo is captured
// as a static 3:4 tile by focus-cropping its card image on /shop. `focus` records realtime and emits
// one .mp4 (the unambiguous primary output a wall input slot consumes); with no actions + a static
// page the clip reads as a still tile. 2s loops cleanly inside the 16s wall (8×).
const PRODUCT_TILES = [
  { name: "tile-coat", n: 1 },
  { name: "tile-crewneck", n: 2 },
  { name: "tile-trouser", n: 3 },
  { name: "tile-slip", n: 4 },
  { name: "tile-blazer", n: 5 },
  { name: "tile-tote", n: 6 },
  { name: "tile-turtleneck", n: 7 },
  { name: "tile-overshirt", n: 8 },
].map((p) => ({
  name: p.name,
  url: "/shop",
  generator: "scroll-reel" as const,
  options: {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 2,
    waitForSelector: ".product img",
    pauseAnimations: true,
    focus: { selector: `.grid .product:nth-child(${p.n}) .product-media`, padding: 0, holdMs: 2000 },
  },
}));

// Lookbook tiles — each /lookbook panel is authored at 3:4, so focus-cropping its #id yields a
// clean tile. These are the TYPE / MARK / spec / editorial stills (the animated count-up tile is
// STAT_YEARS below, kept separate so its animation is NOT frozen).
const LOOKBOOK_TILES = [
  { name: "tile-wordmark", sel: "#lb-wordmark" },
  { name: "tile-manifesto", sel: "#lb-manifesto" },
  { name: "tile-quote", sel: "#lb-quote" },
  { name: "tile-mark", sel: "#lb-mark" },
  { name: "tile-swatch", sel: "#lb-swatch" },
  { name: "tile-spec-coat", sel: "#lb-spec-coat" },
  { name: "tile-spec-tote", sel: "#lb-spec-tote" },
  { name: "tile-editorial", sel: "#lb-editorial" },
  { name: "tile-atelier", sel: "#lb-atelier" },
  { name: "tile-ships", sel: "#lb-ships" },
  { name: "tile-runs", sel: "#lb-runs" },
  { name: "tile-spec-crew", sel: "#lb-spec-crew" },
  { name: "tile-care", sel: "#lb-care" },
].map((t) => ({
  name: t.name,
  url: "/lookbook",
  generator: "scroll-reel" as const,
  options: {
    width: 1280,
    height: 1100,
    deviceScaleFactor: 2,
    waitForSelector: ".lb-grid",
    pauseAnimations: true,
    focus: { selector: t.sel, padding: 0, holdMs: 2000 },
  },
}));

// The showpiece "alive" tile: a CSS count-up. No pauseAnimations (let it run); 4s hold = two full
// 2s count loops, which loops seamlessly inside the 16s wall.
const STAT_YEARS = {
  name: "tile-stat-years",
  url: "/lookbook",
  generator: "scroll-reel" as const,
  options: {
    width: 1280,
    height: 1100,
    deviceScaleFactor: 2,
    waitForSelector: "#lb-stat-years .stat-count",
    focus: { selector: "#lb-stat-years", padding: 0, holdMs: 4000 },
  },
};

// More animated tiles: a 2nd count-up (0→100%) and the auto-cycling mini-gallery. Both self-loop in
// ≤4s, which divides the 16s wall, so they loop seamlessly as tiles.
const STAT_PCT = {
  name: "tile-stat-pct",
  url: "/lookbook",
  generator: "scroll-reel" as const,
  options: {
    width: 1280,
    height: 1100,
    deviceScaleFactor: 2,
    waitForSelector: "#lb-stat-pct .stat-count",
    focus: { selector: "#lb-stat-pct", padding: 0, holdMs: 4000 },
  },
};
const GALLERY = {
  name: "tile-gallery",
  url: "/lookbook",
  generator: "scroll-reel" as const,
  options: {
    width: 1280,
    height: 1100,
    deviceScaleFactor: 2,
    waitForSelector: "#lb-gallery .mg-frame",
    focus: { selector: "#lb-gallery", padding: 0, holdMs: 4000 },
  },
};

export default defineConfig({
  settings: {
    outDir: "public/showcase", // so the Next app serves assets at /showcase/* (and /gallery shows them)
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
  // Assets are PARKED while we plan the small-scale rollout (see the FEEL guidelines above).
  // Promote entries out of the backlog block below into this array one at a time. Empty for now
  // so nothing renders until we've agreed the starter set.
  assets: [
    // ─────────────────────────────────────────────────────────────────────────────────────
    // ACTIVE — media-wall pipeline proof (build order step 2): 8 product photos as static 3:4
    // tiles assembled into a minimal 6-column wall. With only 8 distinct inputs the grid will
    // intentionally repeat them ~2–3× — this validates the producer → wall → render pipeline
    // before we expand to the full ~18-tile timeline (see WALL-TIMELINE.md).
    // ─────────────────────────────────────────────────────────────────────────────────────
    ...PRODUCT_TILES,
    ...LOOKBOOK_TILES,
    STAT_YEARS,
    STAT_PCT,
    GALLERY,
    {
      name: "lookbook-wall",
      generator: "scene",
      // 24 distinct sources = exactly 6 cols × 4 rows. Archetypes interleaved (product · stat · image
      // · type · spec · mark · gallery). Tile→cell uses index (5·col + row) mod 24, so cells s10/s15/
      // s20 are not shown and s2–s4 appear at both edge columns — focal tiles (★) are kept out of
      // those: count-up s5, mini-gallery s9, cognac tote s11, count-up% s16, swatch s19.
      inputs: {
        s1: "tile-coat",
        s2: "tile-trouser",
        s3: "tile-manifesto",
        s4: "tile-turtleneck",
        s5: "tile-stat-years",
        s6: "tile-editorial",
        s7: "tile-spec-coat",
        s8: "tile-quote",
        s9: "tile-gallery",
        s10: "tile-ships",
        s11: "tile-tote",
        s12: "tile-wordmark",
        s13: "tile-crewneck",
        s14: "tile-mark",
        s15: "tile-care",
        s16: "tile-stat-pct",
        s17: "tile-slip",
        s18: "tile-atelier",
        s19: "tile-swatch",
        s20: "tile-spec-crew",
        s21: "tile-blazer",
        s22: "tile-runs",
        s23: "tile-overshirt",
        s24: "tile-spec-tote",
      },
      options: {
        scene: "wall",
        width: 1920,
        height: 1080,
        fps: 30,
        capture: "frames",
        // Single worker: tile <video>s stay warm across sequential seeks. Parallel workers each cold-
        // start their range and capture the seeked frame before it decodes → black tiles at every
        // worker boundary. (Slower, but correct; revisit a parallel-safe warm-up later.)
        workers: 1,
        deviceScaleFactor: 2,
        crf: 18,
        durationSeconds: 16,
        background: "#1a1714",
        sceneOptions: {
          columns: 6,
          padding: 8,
          tileAspect: 0.75,
          cornerRadius: 6,
          background: "#1a1714",
          // Motion direction (Chad): the whole wall moving together should happen ~twice over 16s and
          // gently, with smaller column nudges in between — not the constant 5-pulse churn. So: no
          // constant horizontal pan; few pulses; high variance so ~2 read as the strong moments and
          // the rest as subtle in-between nudges; mostly held between (low drift). NOTE the engine
          // times all columns together (shared progress) — variation comes from per-column speed.
          panLoops: 0,
          panDirection: "left",
          scrollLoopsMin: 1,
          scrollLoopsMax: 2,
          alternate: true,
          pulses: 4,
          pulseDuration: 2.2, // gentler ramps → softer moves ("not as strongly")
          baseDrift: 0.04, // mostly held between pulses
          // Two strong moves (t≈2s, 10s) with small nudges between (t≈6s, 14s). Wide contrast so the
          // nudges read as subtle, not near-equal moves. Explicit weights override the seeded sizes.
          pulseWeights: [1.7, 0.3, 1.7, 0.3],
          pulseVariance: 0.7, // (ignored while pulseWeights is set)
          seed: 7,
        },
      },
    },

    /* ═══ PARKED BACKLOG — uncomment an entry into `assets` above to enable it ═══════════════
    // ─────────────────────────────────────────────────────────────────────────────────────
    // MOTION — storefront films (scroll-reels over the real pages)
    // ─────────────────────────────────────────────────────────────────────────────────────

    // Home film: auto-detected sections + a slow Ken Burns push, branded intro/outro cards,
    // a spotlight on the hero photo, then a highlight ring on the featured product card.
    {
      name: "home",
      generator: "scroll-reel",
      options: {
        waitForSelector: ".hero-media img", // hold for the real hero photo to load
        autoSections: { durationMs: 14000 },
        kenBurns: { scaleTo: 1.05, originY: 0.35 },
        intro: { title: "VESPER", subtitle: "Autumn / Winter 2026", background: "#1a1714", color: "#f6f3ed" },
        outro: { title: "Maison Vesper", subtitle: "Quietly made in Europe", background: "#1a1714", color: "#f6f3ed" },
        annotations: [
          { spotlight: "#hero", text: "Quiet luxury, considered", atMs: 600, untilMs: 4000, position: "bottom" },
          { ring: "#feature-card", text: "The Autumn Edit", atMs: 5000, untilMs: 8500, position: "top" },
        ],
      },
    },

    // Social vertical: a punchy 9:16 cut in multiple formats (mp4 for paid, gif + poster for organic).
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
        waitForSelector: ".hero-media img",
      },
    },

    // The collection page, captured at two viewports (each emits its own asset) so the
    // responsive product grid of real photography reads on desktop and tablet alike.
    {
      name: "shop",
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

    // Product detail: pan the gallery → details → "you may also like", with a ring drawing the
    // eye to the add-to-bag CTA.
    {
      name: "product",
      generator: "scroll-reel",
      url: "/products/the-camel-coat",
      options: {
        waitForSelector: ".pdp-image",
        autoSections: { durationMs: 10000 },
        annotations: [{ ring: "#pdp-add", text: "Add to bag", atMs: 2500, untilMs: 5500, position: "bottom" }],
      },
    },

    // The house / about page, with a gentle zoom over the atelier photography.
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

    // ─────────────────────────────────────────────────────────────────────────────────────
    // FOCUS — element-cropped clips (scroll one component into view, hold, crop to its box)
    // ─────────────────────────────────────────────────────────────────────────────────────

    // The hero, cropped to the photo + headline.
    { name: "hero", generator: "scroll-reel", options: { focus: { selector: "#hero", padding: 0, holdMs: 2500 } } },

    // The home campaign split (real editorial photo + copy).
    { name: "editorial-card", generator: "scroll-reel", options: { focus: { selector: "#editorial", holdMs: 2500 } } },

    // The featured product card — trigger its quick-add, then crop to the card.
    {
      name: "card",
      generator: "scroll-reel",
      options: {
        focus: { selector: "#feature-card", actions: [{ do: "click", selector: "#feature-card .quick-add" }] },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────────────────
    // INTERACTION — scripted realtime tours with a synthetic cursor
    // ─────────────────────────────────────────────────────────────────────────────────────

    // Open the navigation mega-menu and glide across a category link.
    {
      name: "menu",
      generator: "scroll-reel",
      options: {
        cursor: { color: "#8c7355" },
        actions: [
          { do: "click", selector: "#menu-button", holdMs: 700 },
          { do: "hover", selector: "#menu-panel a", holdMs: 900 },
          { do: "wait", holdMs: 600 },
        ],
      },
    },

    // Add the featured piece to the bag from the home grid, then open the cart drawer.
    {
      name: "cart",
      generator: "scroll-reel",
      options: {
        cursor: { color: "#8c7355" },
        actions: [
          { do: "click", selector: "#feature-card .quick-add", holdMs: 700 },
          { do: "click", selector: "#cart-button", holdMs: 1200 },
        ],
      },
    },

    // The buy flow on a product page: choose a size, add to bag, and watch the drawer slide in.
    {
      name: "buy",
      generator: "scroll-reel",
      url: "/products/the-camel-coat",
      options: {
        cursor: { color: "#8c7355" },
        actions: [
          { do: "click", selector: ".size-options button:nth-of-type(4)", holdMs: 600 }, // size L
          { do: "click", selector: "#pdp-add", holdMs: 1400 },
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────────────────────────────
    // TOUR — one reel stitched across the whole journey (home → shop → product → about)
    // ─────────────────────────────────────────────────────────────────────────────────────
    {
      name: "tour",
      generator: "scroll-reel",
      options: {
        intro: { title: "VESPER", subtitle: "A walk through the house", background: "#1a1714", color: "#f6f3ed" },
        routes: [
          { url: "/", autoSections: { durationMs: 7000 } },
          { url: "/shop", autoSections: { durationMs: 6000 } },
          { url: "/products/the-camel-coat", autoSections: { durationMs: 6000 } },
          { url: "/about", autoSections: { durationMs: 6000 } },
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────────────────────────────
    // SCREENSHOTS — responsive stills of the storefront, plus element crops
    // ─────────────────────────────────────────────────────────────────────────────────────
    {
      name: "shots",
      generator: "screenshots",
      options: {
        breakpoints: [
          { name: "desktop", width: 1440, height: 900 },
          { name: "mobile", width: 390, height: 844 },
        ],
        waitForSelector: ".hero-media img",
        elements: [
          { selector: "#hero", name: "hero" },
          { selector: "#new-arrivals", name: "arrivals" },
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────────────────────────────
    // SCENES — composite captures into device frames + a media wall
    // ─────────────────────────────────────────────────────────────────────────────────────

    // Phone: a phone-width capture composited into a phone mockup.
    { name: "phone-cap", generator: "scroll-reel", options: { width: 390, height: 844, duration: 5000, waitForSelector: ".hero-media img" } },
    {
      name: "phone",
      generator: "scene",
      inputs: { screen: "phone-cap" },
      options: { scene: "phone", width: 1080, height: 1350, capture: "frames", durationSeconds: 6 },
    },

    // Desktop: one clean 16:10 capture, reused as the screen for both a laptop and a browser frame.
    { name: "site-cap", generator: "scroll-reel", options: { width: 1440, height: 900, duration: 6000, waitForSelector: ".hero-media img" } },
    {
      name: "laptop",
      generator: "scene",
      inputs: { screen: "site-cap" },
      options: { scene: "laptop", width: 1600, height: 1000, capture: "frames", durationSeconds: 6, background: "#1a1714" },
    },
    {
      name: "browser",
      generator: "scene",
      inputs: { screen: "site-cap" },
      options: {
        scene: "browser",
        width: 1600,
        height: 1000,
        capture: "frames",
        durationSeconds: 6,
        background: "#1a1714",
        sceneOptions: { url: "vesper.example" },
      },
    },

    // Media wall: a marquee of storefront films, panning over an ink backdrop.
    {
      name: "lookbook-wall",
      generator: "scene",
      inputs: { a: "shop", b: "product", c: "about", d: "hero" },
      options: {
        scene: "wall",
        width: 1920,
        height: 1080,
        capture: "frames",
        durationSeconds: 8,
        sceneOptions: { columns: 4, tileAspect: 0.75, background: "#1a1714", cornerRadius: 8 },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────────────────
    // BRAND — colour + type (no URL needed)
    // ─────────────────────────────────────────────────────────────────────────────────────

    // Brand colour palette — still grid.
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

    // The same palette as a looping reveal video.
    {
      name: "colors-reel",
      generator: "palette-reel",
      options: {
        colors: [
          { name: "Ink", hex: "#1a1714" },
          { name: "Paper", hex: "#f6f3ed" },
          { name: "Camel", hex: "#b49a77" },
          { name: "Loden", hex: "#5c5e4c" },
          { name: "Cognac", hex: "#8a5a3c" },
        ],
        details: ["hex", "oklch"],
        uppercase: true,
        background: "#1a1714",
        textLight: "#f6f3ed",
      },
    },

    // Type specimens: three width-stable glyph walls across sans / serif / mono.
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
    ═══ end parked backlog ═══════════════════════════════════════════════════════════════ */
  ],
});
