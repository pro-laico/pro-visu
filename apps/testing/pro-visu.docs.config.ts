import { defineConfig } from "pro-visu";
import { CAMEL, COGNAC, CURSOR, INK, LODEN, PAPER, FASHION } from "./showcase/brand";

// DOCS EXAMPLE ASSETS — the clips/stills embedded in the pro-visu docs (apps/docs), dogfooding
// the FASHION storefront. Separate from the main showcase config (pro-visu.config.ts).
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
    capture: { cleanup: { freezeClock: true } },
    defaults: {
      "scroll-reel": { output: { width: 1280, height: 800, fps: 30 } },
      // The storefront's sticky header is ~100px tall; top-aligned scrollTo drops targets below it.
      interaction: { page: { stickyHeaderHeight: 100 } },
    },
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
    // Scripted tour (seamless loop) across pages: start on the home page, navigate to the shop, browse
    // "The Edit" module, hop to the About page to take in its hero, then click the wordmark home again —
    // landing exactly where it began (home top, cursor resting on the wordmark). The synthetic cursor
    // survives the client-side navigations, so the whole journey is one continuous take.
    {
      name: "docs-browse",
      generator: "interaction",
      url: "/",
      options: {
        output: { width: 1280, height: 800, deviceScaleFactor: 2 },
        cursor: { color: CURSOR },
        page: { waitForSelector: ".hero-media img" },
        setup: [{ do: "move", selector: ".wordmark", durationMs: 0, holdMs: 0 }], // park where the tour ends
        actions: [
          { do: "click", selector: ".nav-inline a:nth-child(1)", durationMs: 600, holdMs: 1300 }, // → /shop
          { do: "scrollTo", to: "#edit", durationMs: 1000, holdMs: 700 }, // frame The Edit
          { do: "click", selector: ".edit-thumb:nth-child(2)", durationMs: 550, holdMs: 900 },
          { do: "click", selector: ".edit-thumb:nth-child(3)", durationMs: 550, holdMs: 900 },
          { do: "click", selector: ".edit-thumb:nth-child(4)", durationMs: 550, holdMs: 1000 },
          { do: "click", selector: ".nav-inline a:nth-child(3)", durationMs: 700, holdMs: 1500 }, // → /about (hero)
          { do: "wait", holdMs: 900 }, // dwell on the About hero
          { do: "click", selector: ".wordmark", durationMs: 700, holdMs: 400 }, // → / home
          { do: "scrollTo", to: 0, durationMs: 0, holdMs: 1400 }, // pin to the top so it matches frame 0 → loops
        ],
      },
    },
    // Seamless loop, cropped to a component: the PDP add-to-bag block (size row + button). Setup
    // selects XS off-camera so the loop opens on the first size; the tour then works up S → M → L → XL
    // and the final tap returns to XS — so the last frame (XS selected, cursor on it) matches the first.
    {
      name: "docs-loop",
      generator: "interaction",
      url: "/products/the-camel-coat",
      options: {
        cursor: { color: CURSOR },
        page: { waitForSelector: ".size-options button" },
        setup: [{ do: "click", selector: ".size-options button:nth-of-type(1)", durationMs: 0, holdMs: 0 }], // start on XS
        focus: {
          selector: ".addbag",
          padding: 24,
          actions: [
            { do: "click", selector: ".size-options button:nth-of-type(2)", durationMs: 420, holdMs: 600 }, // S
            { do: "click", selector: ".size-options button:nth-of-type(3)", durationMs: 420, holdMs: 600 }, // M
            { do: "click", selector: ".size-options button:nth-of-type(4)", durationMs: 420, holdMs: 600 }, // L
            { do: "click", selector: ".size-options button:nth-of-type(5)", durationMs: 420, holdMs: 600 }, // XL
            { do: "click", selector: ".size-options button:nth-of-type(1)", durationMs: 560, holdMs: 900 }, // back to XS → loops
          ],
          holdMs: 300,
        },
      },
    },
    // Element focus (seamless loop): crop to a product card with room around it, and drive it live.
    // The clip opens at rest (cursor parked off the card, so nothing is hovered); then the cursor
    // glides in — the hover-gated controls reveal and the image zooms — the wishlist heart fills, the
    // button confirms "Added to bag", the heart clears, and the cursor glides back off the card, which
    // lifts the hover so the card settles to rest again — an exact match for the opening frame.
    {
      name: "docs-focus",
      generator: "interaction",
      url: "/shop",
      options: {
        cursor: { color: CURSOR },
        page: { waitForSelector: "#feature-card img" },
        setup: [{ do: "move", x: 0.16, y: 0.87, durationMs: 0, holdMs: 0 }], // rest: cursor just below the card
        focus: {
          selector: "#feature-card",
          padding: 26,
          actions: [
            { do: "hover", selector: "#feature-card .product-media", durationMs: 600, holdMs: 900 }, // reveal + zoom
            { do: "click", selector: "#feature-card .wishlist", durationMs: 450, holdMs: 1000 }, // heart fills
            { do: "click", selector: "#feature-card .quick-add", durationMs: 500, holdMs: 1300 }, // → "Added to bag"
            { do: "click", selector: "#feature-card .wishlist", durationMs: 450, holdMs: 700 }, // heart clears (reset)
            { do: "move", x: 0.16, y: 0.87, durationMs: 600, holdMs: 1100 }, // glide off → card deselects → frame 0
          ],
          holdMs: 300,
        },
      },
    },
    // Search flow (the write actions), as a seamless loop. The search filters on SUBMIT (Enter), not
    // per keystroke. Setup lands the camera on the search field (top-aligned, 40px of headroom below
    // the sticky header). Then: search "trousers" → Enter → glance at the result; edit the query —
    // erase, type "knitwear" → Enter → glance across the two results and open the second; dwell on the
    // product, then navigate back to the list so the last frame matches the first. Exercises `type`,
    // `press`, `erase`, and `scrollTo` (align + offset + header height).
    {
      name: "docs-search",
      generator: "interaction",
      url: "/shop",
      options: {
        cursor: { color: CURSOR },
        page: { waitForSelector: "#search-input" },
        setup: [
          { do: "scrollTo", to: "#search-input", align: "top", offset: 40, durationMs: 0, holdMs: 0 }, // start on the search field
          { do: "move", selector: "#search-input", durationMs: 0, holdMs: 0 }, // park the cursor on it (frame 0)
        ],
        actions: [
          { do: "click", selector: "#search-input", holdMs: 400 },
          { do: "type", selector: "#search-input", text: "trousers", delayMs: 55, easing: "ease-out", holdMs: 300 },
          { do: "press", key: "Enter", holdMs: 800 }, // submit → the list updates to the match
          { do: "hover", selector: "#shop-grid .product:first-child .product-media", durationMs: 550, holdMs: 1000 }, // ~1s on the result
          { do: "erase", selector: "#search-input", delayMs: 80, easing: "ease-in", holdMs: 300 }, // back to the field, clear it
          { do: "type", selector: "#search-input", text: "knitwear", delayMs: 55, holdMs: 300 }, // edit the query
          { do: "press", key: "Enter", holdMs: 800 }, // submit → two results
          { do: "hover", selector: "#shop-grid .product:first-child .product-media", durationMs: 550, holdMs: 1000 }, // ~1s on the first
          { do: "hover", selector: "#shop-grid .product:nth-child(2) .product-media", durationMs: 550, holdMs: 1000 }, // ~1s on the second
          { do: "click", selector: "#shop-grid .product:nth-child(2) .product-link", durationMs: 500, holdMs: 2000 }, // open the second, dwell 2s
          { do: "click", selector: ".nav-inline a:nth-child(1)", durationMs: 700, holdMs: 900 }, // → back to the list (/shop)
          { do: "scrollTo", to: "#search-input", align: "top", offset: 40, durationMs: 800, holdMs: 500 }, // glide to the start position
          { do: "move", selector: "#search-input", durationMs: 600, holdMs: 1000 }, // cursor back on the field → matches frame 0 → loops
        ],
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

    // ── Specimen recipes ─────────────────────────────────────────────────────────────────────
    // Each of these is a *coherent composition*: the settings reinforce one intent rather than
    // isolating a single knob. Grouped by the lever that drives the whole recipe.

    // A · ASPECT RATIO drives the layout.
    // 9:16 numeral ticker: many rows only pay off with vertical room + a high fill, and tabular
    // mono digits (uniform width) render as a flawless grid. Random flip-churn = departure board.
    {
      name: "docs-spec-portrait",
      generator: "specimen",
      options: {
        font: "public/fonts/JetBrainsMono.woff2",
        name: "0–9",
        output: { width: 1080, height: 1920 },
        type: { lines: 12, fill: 0.94, weight: 500, leading: 0.9, characterPool: "0123456789" },
        colors: { background: "#0b0b0f", foreground: "#e8e8ea", muted: "#4b5563", accent: "#6ee7a8" },
        colorWeights: { foreground: 2, muted: 2, accent: 1 },
        label: { anchor: "bottom-center", size: 0.16, weight: 600 },
        pulses: [
          { name: "hold", durationMs: 500 },
          { name: "flip", durationMs: 1400, chars: 0.6, pacing: "random" },
          { name: "accent", durationMs: 800, colors: 0.2, color: "accent", pacing: "random" },
          { name: "flip", durationMs: 1400, chars: 0.6, pacing: "random" },
          { name: "hold", durationMs: 500 },
        ],
      },
    },
    // 4:1 ultrawide banner: a single fat line is the only thing that suits the letterbox shape.
    {
      name: "docs-spec-banner",
      generator: "specimen",
      options: {
        font: "public/fonts/InterVariable.woff2",
        name: "Inter",
        output: { width: 2560, height: 640 },
        type: { lines: 1, fill: 0.72, weight: 800 },
        label: { anchor: "bottom-right", size: 0.22, weight: 600 },
        pulses: [
          { name: "hold", durationMs: 600 },
          { name: "run", durationMs: 1600, chars: 0.5, pacing: "linear" },
          { name: "colour", durationMs: 1000, colors: 0.4, pacing: "ease-in-out" },
          { name: "hold", durationMs: 600 },
        ],
      },
    },

    // B · WEIGHT + DENSITY set the mood together.
    // Hairline: weight 100 stays elegant with airy leading + calm motion — a spacious, luxe take.
    // Every knob points the same way (quiet, roomy).
    {
      name: "docs-spec-hairline",
      generator: "specimen",
      options: {
        font: "public/fonts/InterVariable.woff2",
        name: "Inter Thin",
        type: { weight: 100, lines: 4, fill: 0.72, leading: 1.15 },
        label: { anchor: "bottom-left", size: 0.2, weight: 300 },
        animation: { characterIntensity: 0.4, colorIntensity: 0.3 },
        pulses: [
          { name: "still", durationMs: 1600 },
          { name: "breathe", durationMs: 2000, chars: 0.3, pacing: "ease-in-out" },
          { name: "soft tint", durationMs: 1600, colors: 0.25, color: "muted", pacing: "ease-out" },
          { name: "still", durationMs: 1400 },
        ],
      },
    },
    // Heavy mosaic: weight 900 wants density, so pack 10 tight lines and let it churn busily on a
    // dark palette with an accent flash — loud and kinetic, the opposite of the hairline.
    {
      name: "docs-spec-heavy",
      generator: "specimen",
      options: {
        font: "public/fonts/InterVariable.woff2",
        name: "Inter Black",
        type: { weight: 900, lines: 10, fill: 0.9, leading: 0.72 },
        colors: { background: "#0b0b0f", foreground: "#f4f4f5", muted: "#6b7280", accent: "#7c9cff" },
        label: { anchor: "bottom-right", size: 0.3, weight: 800 },
        animation: { characterIntensity: 1.8, colorIntensity: 1.3 },
        pulses: [
          { name: "churn", durationMs: 1400, chars: 0.7, pacing: "random" },
          { name: "flash", durationMs: 700, colors: 0.4, color: "accent", pacing: "random" },
          { name: "churn", durationMs: 1400, chars: 0.7, pacing: "random" },
          { name: "hold", durationMs: 500 },
        ],
      },
    },

    // C · COLOR is the subject.
    // Accent-led: colorWeights makes accent 4× more likely and colorIntensity runs hot, while the
    // glyphs stay calm — so colour, not letters, is what moves. Neon pops on near-black.
    {
      name: "docs-spec-neon",
      generator: "specimen",
      options: {
        font: "public/fonts/InterVariable.woff2",
        name: "accent-led",
        type: { lines: 5, weight: 600, fill: 0.82 },
        colors: { background: "#07070a", foreground: "#e8e8ea", muted: "#2a2a33", accent: "#6ee7a8" },
        colorWeights: { foreground: 1, muted: 1, accent: 4 },
        label: { anchor: "bottom-left", size: 0.24, weight: 600, color: "#6ee7a8" },
        animation: { characterIntensity: 0.5, colorIntensity: 1.8 },
        pulses: [
          { name: "hold", durationMs: 600 },
          { name: "recolour", durationMs: 1800, colors: 0.8, pacing: "random" },
          { name: "drift", durationMs: 1200, chars: 0.2, pacing: "even" },
          { name: "recolour", durationMs: 1800, colors: 0.8, pacing: "random" },
          { name: "hold", durationMs: 600 },
        ],
      },
    },
    // Monochrome: accent is omitted (so it equals the background and every "pop" blends away), muted
    // dominates the weights, and intensity is low — a restrained, single-hue piece.
    {
      name: "docs-spec-mono",
      generator: "specimen",
      options: {
        font: "public/fonts/InterVariable.woff2",
        name: "monochrome",
        type: { lines: 4, weight: 400, fill: 0.8 },
        colors: { background: PAPER, foreground: INK, muted: CAMEL },
        colorWeights: { foreground: 1, muted: 3, accent: 0 },
        label: { anchor: "bottom-left", size: 0.22, weight: 500, color: CAMEL },
        animation: { characterIntensity: 0.4, colorIntensity: 0.5 },
        pulses: [
          { name: "rest", durationMs: 1600 },
          { name: "soft shuffle", durationMs: 1800, chars: 0.25, pacing: "ease-in-out" },
          { name: "to camel", durationMs: 1600, colors: 0.6, color: "muted", pacing: "ease-out" },
          { name: "rest", durationMs: 1400 },
        ],
      },
    },

    // D · GLYPH POOL defines the specimen.
    // Lowercase text face: the pool is a–z, which means descenders (g j p q y) — so leading must rise
    // to 1.0 or they clip. Pool + leading are one coupled decision. Editorial serif on paper.
    {
      name: "docs-spec-lowercase",
      generator: "specimen",
      options: {
        font: "public/fonts/Fraunces.woff2",
        name: "Fraunces text",
        type: { lines: 4, weight: 400, fill: 0.78, leading: 1.0, characterPool: "abcdefghijklmnopqrstuvwxyz" },
        colors: { background: PAPER, foreground: INK, muted: CAMEL, accent: COGNAC },
        label: { anchor: "bottom-left", size: 0.24, weight: 500, color: COGNAC },
        animation: { characterIntensity: 0.6 },
        pulses: [
          { name: "rest", durationMs: 1400 },
          { name: "read", durationMs: 1800, chars: 0.35, pacing: "linear" },
          { name: "cognac", durationMs: 1200, colors: 0.3, color: "accent", pacing: "random" },
          { name: "settle", durationMs: 1200 },
        ],
      },
    },
    // Symbols & punctuation: a symbol pool paired with a monospaced face so the odd-shaped glyphs
    // still lock to an even grid. Terminal palette.
    {
      name: "docs-spec-symbols",
      generator: "specimen",
      options: {
        font: "public/fonts/JetBrainsMono.woff2",
        name: "JetBrains Mono · symbols",
        type: { lines: 6, weight: 500, fill: 0.82, characterPool: "!@#$%^&*()_+-=[]{};:,.<>/?" },
        colors: { background: "#0b0f10", foreground: "#cdd6d3", muted: "#586460", accent: "#6ee7a8" },
        label: { anchor: "bottom-right", size: 0.2, weight: 500 },
        pulses: [
          { name: "idle", durationMs: 900 },
          { name: "type", durationMs: 1500, chars: 0.5, pacing: "ease-out" },
          { name: "accent", durationMs: 900, colors: 0.3, color: "accent", pacing: "random" },
          { name: "type", durationMs: 1300, chars: 0.4, pacing: "ease-in" },
          { name: "rest", durationMs: 700 },
        ],
      },
    },

    // E · MOTION character.
    // One-shot: mirror off means the clip ends on its final state instead of looping back — so the
    // storyboard is written to assemble from near-blank and hold composed, like an intro sting.
    {
      name: "docs-spec-oneshot",
      generator: "specimen",
      options: {
        font: "public/fonts/InterVariable.woff2",
        name: "one-shot",
        type: { lines: 3, weight: 500, fill: 0.8 },
        label: { anchor: "bottom-left", size: 0.22, weight: 500 },
        animation: { mirror: false },
        pulses: [
          { name: "sparse", durationMs: 600 },
          { name: "assemble", durationMs: 2200, chars: 0.9, pacing: "ease-out" },
          { name: "colour in", durationMs: 1600, colors: 0.7, pacing: "ease-in-out" },
          { name: "hold final", durationMs: 1600 },
        ],
      },
    },

    // ── Icon-set showcase ────────────────────────────────────────────────────────────────────
    // A cohesive 16-icon storefront set (public/icons), tinted on ink so it can recolour live.
    // Square, short, frame-stepped — each demonstrates one facet of the step primitive.

    // The default "showcase" preset: a radial scale ripple, then a forward recolour sweep to cognac.
    {
      name: "docs-icons-showcase",
      generator: "icons",
      options: {
        dir: "public/icons",
        template: "showcase",
        accent: COGNAC,
        output: { width: 800, height: 800, durationMs: 6000 },
        layout: { background: INK, gap: 40, padding: 80 },
        base: { color: PAPER },
      },
    },
    // One at a time: stagger 1 walks the scale through the grid in reading order.
    {
      name: "docs-icons-oneatatime",
      generator: "icons",
      options: {
        dir: "public/icons",
        output: { width: 800, height: 800, durationMs: 6000 },
        layout: { background: INK, gap: 40, padding: 80 },
        base: { color: PAPER },
        steps: [{ kind: "scale", at: 0.05, span: 0.9, order: "forward", stagger: 1, scale: 1.7, hold: 0.12 }],
      },
    },
    // A pattern, all at once: stagger 0 fires a checkerboard together, then the alternate rows.
    {
      name: "docs-icons-pattern",
      generator: "icons",
      options: {
        dir: "public/icons",
        output: { width: 800, height: 800, durationMs: 6000 },
        layout: { background: INK, gap: 40, padding: 80 },
        base: { color: PAPER },
        steps: [
          { kind: "color", at: 0.05, span: 0.4, stagger: 0, targets: "checkerboard", color: COGNAC, hold: 0.45 },
          { kind: "color", at: 0.52, span: 0.4, stagger: 0, targets: "rows-alt", color: CAMEL, hold: 0.45 },
        ],
      },
    },
    // Layered: a centre-out scale ripple, a diagonal colour sweep, and a scattered spin — folded
    // together to show steps compose.
    {
      name: "docs-icons-layered",
      generator: "icons",
      options: {
        dir: "public/icons",
        output: { width: 800, height: 800, durationMs: 7000 },
        layout: { background: INK, gap: 40, padding: 80 },
        base: { color: PAPER },
        steps: [
          { kind: "scale", at: 0.02, span: 0.5, order: "radial-out", stagger: 0.75, scale: 1.45 },
          { kind: "color", at: 0.3, span: 0.5, order: "diagonal", stagger: 0.6, color: COGNAC },
          { kind: "spin", at: 0.55, span: 0.4, order: "random", stagger: 0.7, turns: 1 },
        ],
      },
    },
    // Still contact sheet (png): the "pattern" template frozen mid-flash — the whole set at a glance.
    {
      name: "docs-icons-sheet",
      generator: "icons",
      options: {
        dir: "public/icons",
        template: "pattern",
        accent: COGNAC,
        output: { format: "image", width: 900, height: 900, posterTime: 0.25 },
        layout: { background: INK, gap: 44, padding: 84 },
        base: { color: PAPER },
      },
    },

    { name: "docs-palette", generator: "palette", options: { colors: FASHION } },
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
