# auto-showcase

A portable CLI for generating marketing/showcase assets (scroll reels, responsive
screenshots, device-framed videos — with more asset types to come) of the websites you
build. Install it into any website repo, point it at a URL, and it writes assets into a
gitignored `showcase/` folder.

> Status: **v1.** Generators: `scroll-reel` (deterministic frame-stepped recording → mp4 — scroll
> reels, choreographed tours, scripted interaction, social formats and more), `screenshots`
> (responsive full-page + element captures), `device-frame` (the capture composited into a
> browser-window mockup via a single ffmpeg pass), and `scene` (inputs composited inside a web
> scene). The pipeline is a plugin contract, so new asset types slot in without core changes.

> Not on npm yet — see [Using it before it's published](#using-it-before-its-published).

## Quick start (in a website repo)

```bash
# install
pnpm add -D auto-showcase        # or: npx auto-showcase

# scaffold config + gitignore + ensure a browser
npx showcase init

# edit showcase.config.ts, then start your site (or use a deployed URL) and:
npx showcase generate
```

## Config

`showcase init` writes a `showcase.config.ts`. It has two sections — `settings`
(repo-level CLI behavior) and `assets` (what to generate):

```ts
import { defineConfig } from "auto-showcase";

export default defineConfig({
  settings: {
    outDir: "showcase",
    concurrency: 2,
    browser: { headless: true },
    defaults: { "scroll-reel": { width: 1440, height: 900, fps: 30 } },
  },
  assets: [
    { name: "home-reel", url: "https://your-site.com", generator: "scroll-reel" },
  ],
});
```

Config is discovered in multiple formats: `showcase.config.{ts,js,mjs,cjs,json}`,
`.showcaserc`, or a `showcase` key in `package.json`. Use `--config <path>` to override.

## Generators

Each asset picks a `generator`. Defaults live under `settings.defaults["<generator-id>"]`
and are merged beneath each asset's own `options`.

| Generator | Output | Key options |
|---|---|---|
| `scroll-reel` | mp4 of the site (frame-stepped by default) — scroll reels, choreographed tours, interaction demos | `width`/`height`/`fps`/`duration`/`easing` plus `capture`, `choreography`, `autoSections`, `kenBurns`, `loop`, clean-capture, `colorScheme`/`viewports`, `aspect`, `outputs`, `intro`/`outro`, `annotations`, `actions`, `focus`, `routes` — see [Recording reels in depth](#recording-reels-in-depth-scroll-reel) |
| `screenshots` | png/jpeg page + element captures per breakpoint | `breakpoints[]`, `fullPage`, `format`, `elements[]`, `deviceScaleFactor` |
| `device-frame` | mp4 of the site composited into a browser-window mockup (one ffmpeg pass) | `frameWidth`, `background`, plus all `scroll-reel` capture options |
| `scene` | mp4 of inputs composited inside a web scene (phone/laptop/browser) | `scene`, `inputs`, `width`, `height`, `capture`, `durationSeconds`, `workers`, `sceneOptions` |

```ts
assets: [
  { name: "home-reel", url: "https://your-site.com", generator: "scroll-reel" },
  {
    name: "home-shots",
    url: "https://your-site.com",
    generator: "screenshots",
    options: {
      breakpoints: [
        { name: "desktop", width: 1440, height: 900 },
        { name: "mobile", width: 390, height: 844 },
      ],
      elements: [{ selector: "header", name: "nav" }],
    },
  },
  {
    name: "home-frame",
    url: "https://your-site.com",
    generator: "device-frame",
    options: { frameWidth: 1280, background: "#0b0b0f" },
  },
],
```

`device-frame` composites a captured scroll into a static browser-window mockup using a
single ffmpeg pass (the window chrome is painted once with the managed Chromium) — fast and
dependency-light. For richer/animated mockups, use `scene`.

## Recording reels in depth (`scroll-reel`)

`scroll-reel` is the workhorse. By default it captures **frame-stepped**: it drives a virtual
clock, screenshots each frame, and pipes them to ffmpeg — so output is frame-accurate, crisp
(supersampled by `deviceScaleFactor`), parallelized across `workers`, and **byte-identical
run-to-run**. Every option below is a `scroll-reel` option; `device-frame` inherits the
capture-side ones (it composites the same frame-stepped capture into its window chrome).

> Every option has hover docs in `showcase.config.ts` — the authoring types are generated from
> the validation schema, so the editor always matches what the tool accepts.

### Capture mode

| Option | Meaning |
|---|---|
| `capture` | `"frames"` (default) deterministic frame-stepping; `"realtime"` records live (fallback for time-based hero animations / autoplay video). |
| `workers` | Parallel render contexts for `"frames"` (default ≈ half the cores). |
| `frameFormat` | Intermediate frame format for `"frames"`: `"jpeg"` (default) or `"png"` (lossless). |

Choreography, auto-sections, variants, cards, annotations, aspect and extra outputs are
**frames-only**; `realtime` ignores them (with a warning).

### Motion & cinematography

```ts
options: {
  // pause-on-section tour: scroll to a target (0..1, "NN%", or a selector) and hold
  choreography: [
    { to: "#hero", holdMs: 1200 },
    { to: "#features", holdMs: 1500 },
    { to: "100%", durationMs: 1000 },
  ],
  kenBurns: { scaleTo: 1.06 },   // slow zoom over the clip
  loop: "boomerang",             // play forward then back → seamless loop
}
```

- `easing` — `linear`, `easeInOutCubic`/`Quad`, `easeOutCubic`/`Quint`, `easeInOutSine`/`Expo`.
- `choreography: [{ to, durationMs?, holdMs?, easing? }]` — replaces the single sweep with an
  authored sequence (`to` = a `0..1` number, an `"NN%"` string, or a CSS selector to bring into view).
- `autoSections: true | { minHeightFraction?, selector?, holdMs?, durationMs?, maxSections?, constantVelocity? }`
  — auto-detect the page's sections and pan/hold through them within a fixed `durationMs` budget.
- `kenBurns: { scaleFrom?, scaleTo?, easing?, originX?, originY? }` — slow zoom (folds automatically
  under `loop: "boomerang"` so it stays seamless).
- `loop: "none" | "boomerang"`.

### Clean capture

Suppress real-site noise so frames are clean and deterministic:

- `hideSelectors: []`, `injectCss`, `clickSelectors: []` (best-effort consent dismissal),
  `hideScrollbars` (default `true`), `pauseAnimations`, `freezeClock` (pin `Date.now` /
  `performance.now` / `Math.random`).
- Network: `blockTrackers` (default `true` — aborts common analytics/ads/session-replay),
  `blockHosts: []`, `blockResourceTypes: []` (e.g. `["media", "font"]`).
- Settling: `settlePerFrame` (default on; off in `--draft`) waits for fonts + in-view images each
  frame; bounded by `settleMaxMs`.

### Variants — one config, many assets

```ts
options: {
  colorScheme: "both",                              // → <name>-light and <name>-dark
  viewports: [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844, deviceScaleFactor: 3 },
  ],                                                 // → <name>-desktop, <name>-mobile (× schemes)
}
```

- `colorScheme: "light" | "dark" | "both"` (+ `themeClass` to toggle a CSS-class theme).
- `viewports: [{ name, width, height, deviceScaleFactor? }]`.

The viewport × color-scheme matrix is emitted as separate assets (`<name>-<suffix>`).

### Output formats & framing

- `aspect: "16:9" | "9:16" | "1:1" | { width, height }` with `fit: "cover" | "contain"` and `padColor`
  — reframe for social (e.g. `9:16` reels). 
- `outputs: ("mp4" | "gif" | "webp" | "poster")[]` (default `["mp4"]`) — each becomes its own asset;
  `gifFps` tunes the GIF/WebP frame rate.
- `intro` / `outro: { title?, subtitle?, background?, color?, durationMs?, fadeMs? }` — fade-in title
  card / end card.
- `annotations: [{ text?, ring?, spotlight?, atMs?, untilMs?, position? }]` — timed captions, a
  highlight ring around a selector, or a spotlight that dims everything else.

```ts
options: {
  aspect: "9:16",
  outputs: ["mp4", "gif", "poster"],
  intro: { title: "Acme", subtitle: "Botanik" },
  annotations: [{ text: "Real-time data", ring: "#chart", atMs: 1000, untilMs: 3000 }],
}
```

### Scripted interaction & element focus (realtime)

```ts
options: {
  cursor: { color: "#e91e63" },
  actions: [
    { do: "click", selector: "#menu-button" },
    { do: "hover", selector: ".dropdown a:first-child" },
    { do: "type", selector: "input[type=search]", text: "shoes" },
  ],
}
```

- `actions: [{ do: "move" | "click" | "hover" | "type" | "scrollTo" | "wait", selector?, x?, y?, text?, to?, durationMs?, holdMs? }]`
  drives a scripted tour with a synthetic `cursor: { show?, size?, color? }`. Records **realtime**
  (interactions and their animations are time-based).
- `focus: { selector, padding?, actions?, holdMs? }` — capture a single component (optionally trigger
  it first), cropped to its box.

### Multi-page tour

```ts
options: {
  routes: [
    "https://site.com",
    { url: "https://site.com/pricing", autoSections: true },
    { url: "https://site.com/contact", durationMs: 2000 },
  ],
}
```

`routes` captures each page as a frame-stepped segment and concatenates them into one reel; aspect
and extra `outputs` apply to the final tour.

## Scenes & composition

Assets can depend on other assets via `inputs: { slot: assetName }` — producers run first and
their output is fed to the consumer. A **scene** is a small React page (shipped with the tool)
that composites those inputs; e.g. record a phone-sized scroll, then drop it inside a phone
mockup:

```ts
assets: [
  {
    name: "phone-scroll",
    url: "https://your-site.com",
    generator: "scroll-reel",
    options: { width: 390, height: 844 },
  },
  {
    name: "phone-frame",
    generator: "scene",                  // no url — it composites inputs
    inputs: { screen: "phone-scroll" },  // phone-scroll runs first; its mp4 is the screen
    options: { scene: "phone", width: 1080, height: 1350, capture: "frames" },
  },
],
```

- **Built-in scenes:** `phone`, `laptop`, `browser` (pass scene knobs via `sceneOptions`).
- **Capture modes:** `capture: "realtime"` records the page live (simple, webm→mp4);
  `capture: "frames"` steps deterministically (frame-accurate, exact duration, parallelized by
  `workers`). Use `frames` when chaining videos.

## Commands

| Command | What it does |
|---|---|
| `showcase init` | Scaffold config, create + gitignore the output dir, ensure Chromium |
| `showcase generate [--asset <name>]` | Run generators per config; writes assets + `manifest.json` |
| `showcase list` | Show generated assets recorded in the manifest |

`generate` flags: `--draft` (faster, lower-fidelity iteration), `--cache` (skip assets whose
inputs+options are unchanged), `--skip-server` (use an already-running site), `--concurrency`,
`--verbose`. A managed server (`settings.server`) can build → start → capture → stop the site
automatically so the npm script is just `showcase generate`.

## Using it before it's published

`auto-showcase` isn't on npm yet, but you can use it in a real website repo today. Pick one:

**A — From this GitHub repo (simplest):**
```bash
pnpm add -D github:chad-hill/auto-showcase
```
pnpm builds it on install (via the `prepare` script), so the `showcase` binary is ready.

**B — From a local clone with `pnpm link` (best while iterating on the tool):**
```bash
# in the auto-showcase repo
pnpm install && pnpm build && pnpm link --global
# in your website repo
pnpm link --global auto-showcase
```
Re-run `pnpm build` in the tool repo after changes; the link picks them up.

**C — As a local `file:` dependency (pinned path):**
```bash
pnpm -C /path/to/auto-showcase install && pnpm -C /path/to/auto-showcase build
# then in your website repo's package.json:
#   "devDependencies": { "auto-showcase": "file:/path/to/auto-showcase" }
pnpm install
```

Then, in your website repo:
```bash
npx showcase init        # scaffolds showcase.config.ts, gitignores showcase/, installs Chromium
npx showcase generate    # point a target at a deployed URL or a localhost you've started
```

The first run downloads a Chromium for Playwright (one-time, cached and shared across
projects); `device-frame` reuses that same browser.

## Developing auto-showcase

```bash
pnpm install            # installs deps; `prepare` builds dist/
pnpm dev                # tsup --watch
pnpm build              # tsup -> dist/
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest (unit)
```

**Manual end-to-end run** — drive the built CLI against a throwaway folder, no linking needed.
A JSON config avoids needing the package resolvable for a `defineConfig` import:
```bash
pnpm build
mkdir /tmp/probe && cd /tmp/probe
printf '{ "assets": [ { "name": "demo", "url": "https://example.com", "generator": "scroll-reel" } ] }' > showcase.config.json
node /path/to/auto-showcase/dist/cli/index.js generate --cwd . --config showcase.config.json
```
To exercise the real consumer path (a TS `showcase.config.ts` that imports `defineConfig`,
or `scene` loading its bundled web app), the package must be resolvable from that folder — use
option B/C above, or a `node_modules/auto-showcase` junction to this repo.

**Adding a generator:** implement the `Generator` contract in `src/generators/<id>/`,
`register()` it in `src/generators/registry.ts`, and extend the `AssetSpecInput` union +
`settings.defaults` in `src/config/define-config.ts`. No pipeline or CLI changes needed.

## License

MIT
