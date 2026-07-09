import { defineConfig } from "pro-visu";

import { CAMEL, COGNAC, CURSOR, INK, LODEN, PAPER, FASHION } from "../showcase/brand";

export default defineConfig({
  settings: {
    outDir: "../public/pro-visu/docs",
    capture: { cleanup: { freezeClock: true } },
    defaults: { "scroll-reel": { output: { width: 1280, height: 800, fps: 30 } }, interaction: { page: { stickyHeaderHeight: 100 } } },
  },
  assets: [
    {
      name: "docs-home",
      generator: "scroll-reel",
      options: {
        output: { width: 1280, height: 800, deviceScaleFactor: 3 },
        motion: { easing: "ease-in-out", loop: "boomerang", autoSections: { durationMs: 22000, holdMs: 1600 } },
        page: { waitForSelector: ".hero-media img" },
      },
    },
    {
      name: "docs-scroll",
      generator: "scroll-reel",
      options: {
        page: { waitForSelector: ".hero-media img" },
        motion: { autoSections: { durationMs: 9000 } },
      },
    },
    {
      name: "docs-straight",
      generator: "scroll-reel",
      options: {
        page: { waitForSelector: ".hero-media img" },
        motion: { loop: "straight", autoSections: { durationMs: 14000 } },
      },
    },
    {
      name: "docs-browse",
      generator: "interaction",
      url: "/",
      options: {
        output: { width: 1280, height: 800, deviceScaleFactor: 2 },
        cursor: { color: CURSOR },
        page: { waitForSelector: ".hero-media img" },
        setup: [{ do: "move", selector: ".wordmark", durationMs: 0, holdMs: 0 }],
        actions: [
          { do: "click", selector: ".nav-inline a:nth-child(1)", durationMs: 600, holdMs: 1300 },
          { do: "scrollTo", to: "#edit", durationMs: 1000, holdMs: 700 },
          { do: "click", selector: ".edit-thumb:nth-child(2)", durationMs: 550, holdMs: 900 },
          { do: "click", selector: ".edit-thumb:nth-child(3)", durationMs: 550, holdMs: 900 },
          { do: "click", selector: ".edit-thumb:nth-child(4)", durationMs: 550, holdMs: 1000 },
          { do: "click", selector: ".nav-inline a:nth-child(3)", durationMs: 700, holdMs: 1500 },
          { do: "wait", holdMs: 900 },
          { do: "click", selector: ".wordmark", durationMs: 700, holdMs: 400 },
          { do: "scrollTo", to: 0, durationMs: 0, holdMs: 1400 },
        ],
      },
    },
    {
      name: "docs-loop",
      generator: "interaction",
      url: "/products/the-camel-coat",
      options: {
        cursor: { color: CURSOR },
        page: { waitForSelector: ".size-options button" },
        setup: [{ do: "click", selector: ".size-options button:nth-of-type(1)", durationMs: 0, holdMs: 0 }],
        focus: {
          selector: ".addbag",
          padding: 24,
          actions: [
            { do: "click", selector: ".size-options button:nth-of-type(2)", durationMs: 420, holdMs: 600 },
            { do: "click", selector: ".size-options button:nth-of-type(3)", durationMs: 420, holdMs: 600 },
            { do: "click", selector: ".size-options button:nth-of-type(4)", durationMs: 420, holdMs: 600 },
            { do: "click", selector: ".size-options button:nth-of-type(5)", durationMs: 420, holdMs: 600 },
            { do: "click", selector: ".size-options button:nth-of-type(1)", durationMs: 560, holdMs: 900 },
          ],
          holdMs: 300,
        },
      },
    },
    {
      name: "docs-focus",
      generator: "interaction",
      url: "/shop",
      options: {
        cursor: { color: CURSOR },
        page: { waitForSelector: "#feature-card img" },
        setup: [{ do: "move", x: 0.16, y: 0.87, durationMs: 0, holdMs: 0 }],
        focus: {
          selector: "#feature-card",
          padding: 26,
          actions: [
            { do: "hover", selector: "#feature-card .product-media", durationMs: 600, holdMs: 900 },
            { do: "click", selector: "#feature-card .wishlist", durationMs: 450, holdMs: 1000 },
            { do: "click", selector: "#feature-card .quick-add", durationMs: 500, holdMs: 1300 },
            { do: "click", selector: "#feature-card .wishlist", durationMs: 450, holdMs: 700 },
            { do: "move", x: 0.16, y: 0.87, durationMs: 600, holdMs: 1100 },
          ],
          holdMs: 300,
        },
      },
    },
    {
      name: "docs-search",
      generator: "interaction",
      url: "/shop",
      options: {
        cursor: { color: CURSOR },
        page: { waitForSelector: "#search-input" },
        setup: [
          { do: "scrollTo", to: "#search-input", align: "top", offset: 40, durationMs: 0, holdMs: 0 },
          { do: "move", selector: "#search-input", durationMs: 0, holdMs: 0 },
        ],
        actions: [
          { do: "click", selector: "#search-input", holdMs: 400 },
          { do: "type", selector: "#search-input", text: "trousers", delayMs: 55, easing: "ease-out", holdMs: 300 },
          { do: "press", key: "Enter", holdMs: 800 },
          { do: "hover", selector: "#shop-grid .product:first-child .product-media", durationMs: 550, holdMs: 1000 },
          { do: "erase", selector: "#search-input", delayMs: 80, easing: "ease-in", holdMs: 300 },
          { do: "type", selector: "#search-input", text: "knitwear", delayMs: 55, holdMs: 300 },
          { do: "press", key: "Enter", holdMs: 800 },
          { do: "hover", selector: "#shop-grid .product:first-child .product-media", durationMs: 550, holdMs: 1000 },
          { do: "hover", selector: "#shop-grid .product:nth-child(2) .product-media", durationMs: 550, holdMs: 1000 },
          { do: "click", selector: "#shop-grid .product:nth-child(2) .product-link", durationMs: 500, holdMs: 2000 },
          { do: "click", selector: ".nav-inline a:nth-child(1)", durationMs: 700, holdMs: 900 },
          { do: "scrollTo", to: "#search-input", align: "top", offset: 40, durationMs: 800, holdMs: 500 },
          { do: "move", selector: "#search-input", durationMs: 600, holdMs: 1000 },
        ],
      },
    },
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

    {
      name: "docs-icons-showcase",
      generator: "icons",
      options: {
        dir: "public/icons",
        template: "showcase",
        accent: COGNAC,
        output: { width: 800, height: 800 },
        motion: { durationMs: 6000 },
        layout: { background: INK, gap: 40, padding: 80 },
        base: { color: PAPER },
      },
    },
    {
      name: "docs-icons-oneatatime",
      generator: "icons",
      options: {
        dir: "public/icons",
        output: { width: 800, height: 800 },
        motion: { durationMs: 6000 },
        layout: { background: INK, gap: 40, padding: 80 },
        base: { color: PAPER },
        steps: [{ kind: "scale", at: 0.05, span: 0.9, order: "forward", stagger: 0.85, scale: 1.6, hold: 0.2 }],
      },
    },
    {
      name: "docs-icons-pattern",
      generator: "icons",
      options: {
        dir: "public/icons",
        output: { width: 800, height: 800 },
        motion: { durationMs: 6000 },
        layout: { background: INK, gap: 40, padding: 80 },
        base: { color: PAPER },
        steps: [
          { kind: "color", at: 0.05, span: 0.4, stagger: 0, targets: "checkerboard", color: COGNAC, hold: 0.45 },
          { kind: "color", at: 0.52, span: 0.4, stagger: 0, targets: "rows-alt", color: CAMEL, hold: 0.45 },
        ],
      },
    },
    {
      name: "docs-icons-layered",
      generator: "icons",
      options: {
        dir: "public/icons",
        output: { width: 800, height: 800 },
        motion: { durationMs: 7000 },
        layout: { background: INK, gap: 40, padding: 80 },
        base: { color: PAPER },
        steps: [
          { kind: "scale", at: 0.02, span: 0.5, order: "radial-out", stagger: 0.6, scale: 1.45 },
          { kind: "color", at: 0.3, span: 0.5, order: "diagonal", stagger: 0.6, color: COGNAC },
          { kind: "spin", at: 0.55, span: 0.4, order: "random", stagger: 0.7, turns: 1 },
        ],
      },
    },
    {
      name: "docs-icons-sheet",
      generator: "icons",
      options: {
        dir: "public/icons",
        template: "pattern",
        accent: COGNAC,
        output: { format: "image", width: 900, height: 900 },
        motion: { posterTime: 0.25 },
        layout: { background: INK, gap: 44, padding: 84 },
        base: { color: PAPER },
      },
    },

    { name: "docs-palette", generator: "palette", options: { colors: FASHION } },
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
    {
      name: "docs-shot-desktop",
      generator: "screenshots",
      options: {
        viewports: [{ name: "desktop", width: 1440, height: 900 }],
        fullPage: true,
        page: { waitForSelector: ".hero-media img" },
      },
    },
    {
      name: "docs-shot-mobile",
      generator: "screenshots",
      options: {
        viewports: [{ name: "mobile", width: 390, height: 844 }],
        fullPage: false,
        page: { waitForSelector: ".hero-media img" },
      },
    },
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
    {
      name: "docs-wall-test",
      generator: "wall",
      options: {
        output: { width: 960, height: 540, fps: 30 },
        render: { capture: "realtime" },
        motion: { durationMs: 8000, loops: 1 },
        preview: { enabled: true },
        layout: { background: INK, gap: 4, cornerRadius: 4, tileAspect: 0.5625 },
        columns: [
          { tiles: ["home", "pricing"], direction: "down" },
          { tiles: ["product", "lookbook"], direction: "up", stagger: 0.4 },
          { tiles: ["about", "contact"], direction: "down", stagger: 0.2 },
        ],
      },
    },
  ],
});
