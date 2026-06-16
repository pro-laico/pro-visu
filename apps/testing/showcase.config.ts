import { defineConfig, type AssetSpecInput } from "auto-showcase";

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
// Media wall — a quiet grid of MOBILE phone screens. Most of the time each tile just sits there like a
// nice still of the storefront; now and then one does a single thing (a drawer slides in, the menu
// opens, a heart fills, a size is chosen). Two small producer families feed it:
//   IMAGE_TILES — a few full-res photos via the `image` generator (passthrough → full source res). The
//                 photography is the accent here, not the bulk — the videos lead.
//   CLIPS       — mobile-viewport (390×844) interaction clips, each EXACTLY 8s so it loops 3× inside
//                 the 24s wall. Authored as: hold still on a component → one interaction → settle back
//                 to rest, so the loop is seamless. Cursor hidden (the UI animates on its own — cleaner
//                 than a pointer dot on a small tile; flip `cursor.show` true to show the camel cursor).
// LIVE — to return to fast layout/motion iteration, re-wrap this block as a comment, comment out the
// spreads in `assets`, and set `test: true` back on the wall.
const IMAGE_TILES = [
  { name: "img-hero", src: "public/img/hero.jpg" },
  { name: "img-editorial", src: "public/img/editorial.jpg" },
  { name: "img-atelier", src: "public/img/about-atelier.jpg" },
  { name: "img-tote", src: "public/img/products/leather-tote.jpg" }, // cognac accent
].map((t): AssetSpecInput => ({ name: t.name, generator: "image", options: { src: t.src } }));

// Mobile interaction clips. Shared recipe (`CLIP_VIEW`): a 390×844 phone viewport, cursor hidden, and
// per-clip budgets that sum to EXACTLY 8000ms — startDelayMs + endDwellMs + Σ(durationMs + holdMs). The
// generator trims the kept clip to that length (dropping the nav lead), so 8s is exact and each loops 3×
// inside the 24s wall. Every click/hover first scrolls its target to centre, so the opening `hover`
// frames the component and the clip reads as: a still phone screen → one interaction → back to rest.
//
// SIX distinct clips (no clip is reused on the wall → no synchronised "twins"). Their interaction
// WINDOWS are deliberately staggered across the 8s — menu ≈1.0–3.9s · wishlist ≈2.0–4.8 · cart ≈3.2–6.2
// · cart-trouser ≈4.4–7.4 · size ≈5.4–8.0 · wishlist-slip ≈6.0–8.0 — so the wall never goes "all still
// then all active" at once; at any moment one or two tiles are doing their thing while the rest hold.
const CLIP_VIEW = { width: 390, height: 844, deviceScaleFactor: 2, fps: 30, cursor: { show: false } };
const CLIPS: AssetSpecInput[] = [
  {
    name: "clip-menu", // Home: hold on the hero → open the mega-menu → close → rest (acts EARLY)
    url: "/",
    generator: "scroll-reel",
    options: {
      ...CLIP_VIEW,
      waitForSelector: ".hero-media img",
      startDelayMs: 1000,
      endDwellMs: 4100,
      actions: [
        { do: "click", selector: "#menu-button", durationMs: 0, holdMs: 1600 }, // mega panel opens
        { do: "click", selector: "#menu-button", durationMs: 0, holdMs: 1300 }, // and closes (toggle)
      ],
    },
  },
  {
    name: "clip-wishlist", // Shop p1 (coat): hold on the card → tap the heart (fills) → tap (empties) → rest
    url: "/shop",
    generator: "scroll-reel",
    options: {
      ...CLIP_VIEW,
      waitForSelector: "#shop-grid .product img",
      startDelayMs: 0,
      endDwellMs: 3200,
      actions: [
        { do: "hover", selector: "#shop-grid .product:nth-child(1) .product-media", durationMs: 0, holdMs: 2000 },
        { do: "click", selector: "#shop-grid .product:nth-child(1) .wishlist", durationMs: 0, holdMs: 1500 }, // heartPop
        { do: "click", selector: "#shop-grid .product:nth-child(1) .wishlist", durationMs: 0, holdMs: 1300 }, // unsave
      ],
    },
  },
  {
    name: "clip-cart", // PDP coat: hold on Add-to-bag → tap → cart drawer slides in → close → rest
    url: "/products/the-camel-coat",
    generator: "scroll-reel",
    options: {
      ...CLIP_VIEW,
      waitForSelector: "#pdp-add",
      startDelayMs: 0,
      endDwellMs: 1800,
      actions: [
        { do: "hover", selector: "#pdp-add", durationMs: 0, holdMs: 3200 }, // centre + hold still
        { do: "click", selector: "#pdp-add", durationMs: 0, holdMs: 1700 }, // drawer slides in (0.4s)
        { do: "click", selector: "#cart-drawer .drawer-close", durationMs: 0, holdMs: 1300 }, // slides out
      ],
    },
  },
  {
    name: "clip-cart-trouser", // PDP trouser: same flow, a DIFFERENT bag ($ + product) → not a twin of clip-cart
    url: "/products/pleated-wool-trouser",
    generator: "scroll-reel",
    options: {
      ...CLIP_VIEW,
      waitForSelector: "#pdp-add",
      startDelayMs: 0,
      endDwellMs: 600,
      actions: [
        { do: "hover", selector: "#pdp-add", durationMs: 0, holdMs: 4400 }, // longer still, acts later
        { do: "click", selector: "#pdp-add", durationMs: 0, holdMs: 1700 }, // drawer slides in
        { do: "click", selector: "#cart-drawer .drawer-close", durationMs: 0, holdMs: 1300 }, // slides out
      ],
    },
  },
  {
    name: "clip-size", // PDP slip: hold on the size row → tap L → tap back to M (the default) → rest (acts LATE)
    url: "/products/silk-slip-dress",
    generator: "scroll-reel",
    options: {
      ...CLIP_VIEW,
      waitForSelector: "#pdp-add",
      startDelayMs: 0,
      endDwellMs: 0,
      actions: [
        { do: "hover", selector: ".size-options", durationMs: 0, holdMs: 5400 }, // long still on the chips
        { do: "click", selector: ".size-options button:nth-of-type(4)", durationMs: 0, holdMs: 1400 }, // L
        { do: "click", selector: ".size-options button:nth-of-type(3)", durationMs: 0, holdMs: 1200 }, // back to M
      ],
    },
  },
  {
    name: "clip-wishlist-slip", // Shop p4 (slip): heart on a different product → not a twin of clip-wishlist
    url: "/shop",
    generator: "scroll-reel",
    options: {
      ...CLIP_VIEW,
      waitForSelector: "#shop-grid .product img",
      startDelayMs: 0,
      endDwellMs: 0,
      actions: [
        { do: "hover", selector: "#shop-grid .product:nth-child(4) .product-media", durationMs: 0, holdMs: 6000 }, // long still
        { do: "click", selector: "#shop-grid .product:nth-child(4) .wishlist", durationMs: 0, holdMs: 1200 }, // heartPop
        { do: "click", selector: "#shop-grid .product:nth-child(4) .wishlist", durationMs: 0, holdMs: 800 }, // unsave
      ],
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
  // LIVE — the media wall, fed by its tile producers. The wall is the only top-level asset for now
  // (the rest of the program lives in the parked backlog below); promote those one at a time.
  assets: [
    // ─────────────────────────────────────────────────────────────────────────────────────
    // THE WALL'S TILE PRODUCERS — 4 full-res photos + 6 mobile interaction clips. The wall derives its
    // dependencies from these by name, so they must sit in `assets` alongside it.
    // ─────────────────────────────────────────────────────────────────────────────────────
    ...IMAGE_TILES,
    ...CLIPS,
    {
      name: "lookbook-wall",
      generator: "wall",
      // No `inputs` map — each column lists the tiles it stacks (by name), so the wall derives its
      // dependencies from the columns below. 5 columns × 2 tiles = 10 slots: 6 are mobile clips
      // (videos lead), 4 are photos (accent). Each column carries its OWN gentle Y drift.
      options: {
        width: 1920,
        height: 1080,
        fps: 30,
        // Real render: "frames" is frame-exact and crisp (supersampled). For fast layout/motion
        // iteration, set `test: true` (faux tiles) + "realtime" for a seconds-long preview.
        capture: "frames",
        // Single worker: tile <video>s stay warm across sequential seeks. Parallel workers each cold-
        // start their range and capture the seeked frame before it decodes → black tiles at every
        // worker boundary. (Slower, but correct; revisit a parallel-safe warm-up later.)
        workers: 1,
        deviceScaleFactor: 2,
        crf: 18,
        durationSeconds: 24, // the "main" clip; 24 = 3 × the 8s tile clips, so every tile loops cleanly
        background: "#1a1714",
        gap: 2,
        tileAspect: 0.75, // fallback only — tiles take their own height (mobile clips ~9:19, photos ~3:4 → masonry)
        cornerRadius: 0,
        // Motion — deliberately quiet so the wall reads like a grid of still phone screens, the life
        // coming from the clips' own interactions. Each column does ONE gentle, seamless drift over the
        // 24s (`loops: 1`), neighbours alternating up/down with spread `stagger`s so they neither move
        // in lockstep nor line up. No X pan, no pulses — calm. (For an even stiller look, set a column's
        // `loops: 0` to pin it: it then features its top tile with the next as a peek.)
        loops: 1, // one seamless tile-set drift over the clip, for every column that doesn't override it
        // Each column = its tiles (top→bottom, cycled to fill) + its motion. `stagger` (0..1) offsets a
        // column's start position; `direction` flips the drift. All six clips are distinct (no tile is
        // reused), so nothing reads as a synchronised twin.
        columns: [
          { tiles: ["clip-cart", "img-hero"], direction: "down", stagger: 0.0 },
          { tiles: ["clip-menu", "img-editorial"], direction: "up", stagger: 0.42 },
          { tiles: ["clip-wishlist", "img-atelier"], direction: "down", stagger: 0.68 },
          { tiles: ["clip-size", "img-tote"], direction: "up", stagger: 0.18 },
          { tiles: ["clip-cart-trouser", "clip-wishlist-slip"], direction: "down", stagger: 0.54 }, // all-video column
        ],
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
