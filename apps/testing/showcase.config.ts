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
// Media-wall tiles — REAL, high-fidelity content (replacing the earlier synthetic lookbook panels
// and low-res focus-crops):
//   IMAGE_TILES — the actual high-resolution asset photos, used directly via the `image` generator
//                 (no re-capture, so full source resolution).
//   UI_PAGES    — crisp 3:4 captures of the real storefront pages.
//   CLIPS       — short looping clips of the real UI in motion / interactions.
const IMAGE_TILES = [
  { name: "img-coat", src: "public/img/products/the-camel-coat.jpg" },
  { name: "img-crew", src: "public/img/products/cashmere-crewneck.jpg" },
  { name: "img-trouser", src: "public/img/products/pleated-wool-trouser.jpg" },
  { name: "img-slip", src: "public/img/products/silk-slip-dress.jpg" },
  { name: "img-blazer", src: "public/img/products/double-breasted-blazer.jpg" },
  { name: "img-tote", src: "public/img/products/leather-tote.jpg" },
  { name: "img-turtle", src: "public/img/products/ribbed-turtleneck.jpg" },
  { name: "img-overshirt", src: "public/img/products/tailored-overshirt.jpg" },
  { name: "img-editorial", src: "public/img/editorial.jpg" },
  { name: "img-atelier", src: "public/img/about-atelier.jpg" },
  { name: "img-hero", src: "public/img/hero.jpg" },
  { name: "img-abouthero", src: "public/img/about-hero.jpg" },
].map((t) => ({ name: t.name, generator: "image" as const, options: { src: t.src } }));

// Real storefront pages, captured as crisp 3:4 viewport stills. screenshots' page shot is the
// producer's primary output, so each feeds a wall tile directly (no element-index ambiguity).
const UI_PAGES = [
  { name: "ui-home", url: "/" },
  { name: "ui-shop", url: "/shop" },
  { name: "ui-pdp-coat", url: "/products/the-camel-coat" },
  { name: "ui-pdp-slip", url: "/products/silk-slip-dress" },
  { name: "ui-about", url: "/about" },
  { name: "ui-lookbook", url: "/lookbook" },
].map((t) => ({
  name: t.name,
  url: t.url,
  generator: "screenshots" as const,
  options: {
    fullPage: false,
    waitForSelector: "img",
    breakpoints: [{ name: "tile", width: 900, height: 1200, deviceScaleFactor: 2 }],
  },
}));

// Short clips of the real UI in motion at 3:4. The interaction clips return to their start state so
// they read as loops (realtime → duration varies, so a tiny seam at the wall wrap is acceptable on
// these few tiles); the boomerang scroll is frame-stepped at an exact 4s (divides 16s) for a perfect
// loop. Cursor is the brand camel.
const CLIPS = [
  {
    name: "clip-cart", // add to bag → cart drawer slides in → close
    url: "/products/the-camel-coat",
    generator: "scroll-reel" as const,
    options: {
      width: 900,
      height: 1200,
      deviceScaleFactor: 2,
      fps: 30,
      cursor: { color: "#8c7355" },
      actions: [
        { do: "click" as const, selector: ".size-options button:nth-of-type(3)", holdMs: 500 },
        { do: "click" as const, selector: "#pdp-add", holdMs: 1800 },
        { do: "click" as const, selector: "#cart-drawer .drawer-close", holdMs: 1500 },
      ],
    },
  },
  {
    name: "clip-menu", // open mega-menu → hover a link → close (over the lookbook)
    url: "/lookbook",
    generator: "scroll-reel" as const,
    options: {
      width: 900,
      height: 1200,
      deviceScaleFactor: 2,
      fps: 30,
      cursor: { color: "#8c7355" },
      actions: [
        { do: "click" as const, selector: "#menu-button", holdMs: 900 },
        { do: "hover" as const, selector: "#menu-panel a", holdMs: 900 },
        { do: "click" as const, selector: "#menu-button", holdMs: 1200 },
      ],
    },
  },
  {
    name: "clip-quickadd", // hover a card → quick-add slides up → move away
    url: "/shop",
    generator: "scroll-reel" as const,
    options: {
      width: 900,
      height: 1200,
      deviceScaleFactor: 2,
      fps: 30,
      cursor: { color: "#8c7355" },
      actions: [
        { do: "hover" as const, selector: "#shop-grid .product:nth-child(1) .product-media", holdMs: 1600 },
        { do: "move" as const, x: 0.5, y: 0.96, holdMs: 1200 },
      ],
    },
  },
  {
    name: "clip-wishlist", // tap the heart on → off (home new-arrivals grid)
    url: "/",
    generator: "scroll-reel" as const,
    options: {
      width: 900,
      height: 1200,
      deviceScaleFactor: 2,
      fps: 30,
      cursor: { color: "#8c7355" },
      actions: [
        { do: "hover" as const, selector: "#new-arrivals .product:nth-child(2) .product-media", holdMs: 400 },
        { do: "click" as const, selector: "#new-arrivals .product:nth-child(2) .wishlist", holdMs: 1300 },
        { do: "click" as const, selector: "#new-arrivals .product:nth-child(2) .wishlist", holdMs: 1300 },
      ],
    },
  },
  {
    name: "clip-size", // cycle size chips S → M → L → M (on the slip dress)
    url: "/products/silk-slip-dress",
    generator: "scroll-reel" as const,
    options: {
      width: 900,
      height: 1200,
      deviceScaleFactor: 2,
      fps: 30,
      cursor: { color: "#8c7355" },
      actions: [
        { do: "click" as const, selector: ".size-options button:nth-of-type(1)", holdMs: 700 },
        { do: "click" as const, selector: ".size-options button:nth-of-type(3)", holdMs: 700 },
        { do: "click" as const, selector: ".size-options button:nth-of-type(4)", holdMs: 700 },
        { do: "click" as const, selector: ".size-options button:nth-of-type(3)", holdMs: 700 },
      ],
    },
  },
  {
    name: "clip-scroll", // gentle page scroll (about), perfect 4s boomerang loop
    url: "/about",
    generator: "scroll-reel" as const,
    options: {
      width: 900,
      height: 1200,
      deviceScaleFactor: 2,
      fps: 30,
      duration: 4000,
      loop: "boomerang" as const,
      waitForSelector: ".about-hero-media img",
    },
  },
];

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
    // ACTIVE — the media wall + its tile producers: real high-res images + real UI captures +
    // looping interaction clips (see WALL-TIMELINE.md).
    // ─────────────────────────────────────────────────────────────────────────────────────
    ...IMAGE_TILES,
    ...UI_PAGES,
    ...CLIPS,
    {
      name: "lookbook-wall",
      generator: "scene",
      // 24 distinct sources = exactly 6 cols × 4 rows, interleaved (image · UI · clip). Tile→cell uses
      // index (5·col + row) mod 24, so cells s10/s15/s20 aren't shown and s2–s4 repeat at both edge
      // columns — so those carry static images (fine to repeat), and the cognac-tote accent (s7) +
      // the motion clips are placed elsewhere.
      inputs: {
        s1: "img-coat",
        s2: "img-crew",
        s3: "img-editorial",
        s4: "img-trouser",
        s5: "clip-cart",
        s6: "ui-home",
        s7: "img-tote",
        s8: "ui-shop",
        s9: "clip-quickadd",
        s10: "img-turtle",
        s11: "img-slip",
        s12: "clip-menu",
        s13: "ui-pdp-coat",
        s14: "img-atelier",
        s15: "img-overshirt",
        s16: "clip-wishlist",
        s17: "img-hero",
        s18: "ui-about",
        s19: "clip-size",
        s20: "img-blazer",
        s21: "ui-lookbook",
        s22: "clip-scroll",
        s23: "img-abouthero",
        s24: "ui-pdp-slip",
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
