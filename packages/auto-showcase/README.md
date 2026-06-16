# auto-showcase

A portable CLI for generating marketing/showcase assets (scroll reels, responsive
screenshots, media walls — with more asset types to come) of the websites you build. Install it
into any website repo, point it at a URL, and it writes assets into a gitignored `showcase/`
folder.

> Status: **0.2** (pre-1.0; the option surface may still shift). Generators: `scroll-reel` (deterministic frame-stepped recording → mp4 — scroll
> reels, choreographed tours, scripted interaction, social formats and more), `screenshots`
> (responsive full-page + element captures), `wall` (a seamless-looping media wall of your
> assets), `image` (register a file for reuse), plus `specimen`/`palette`/`palette-reel`. The
> pipeline is a plugin contract, so new asset types slot in without core changes.

> Requires Node ≥ 18.18. The first run downloads a managed Chromium (cached and shared
> across projects); ffmpeg is bundled — no global installs required.

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
| `wall` | mp4 media wall — columns of your assets, each scrolling on its own, looping seamlessly | `columns[]` (tiles + per-column motion), `pulses`, `loops`, `pan`, `gap`/`tileAspect`/`cornerRadius`, `stagger`, `test` |
| `image` | passthrough — registers an existing image file as an asset (e.g. a wall tile) | `src`, `fileName` |
| `specimen` / `palette` / `palette-reel` | type specimen / colour palette (still + reel) | see the [docs](https://github.com/chad-hill/auto-showcase#readme) |

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
],
```

## Recording reels in depth (`scroll-reel`)

`scroll-reel` is the workhorse. By default it captures **frame-stepped**: it drives a virtual
clock, screenshots each frame, and pipes them to ffmpeg — so output is frame-accurate, crisp
(supersampled by `deviceScaleFactor`), parallelized across `workers`, and **byte-identical
run-to-run**. Every option below is a `scroll-reel` option.

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

## Media wall & composition

Assets can depend on other assets via `inputs: { slot: assetName }` — producers run first and
their output is fed to the consumer. The **`wall`** generator composites assets into a seamless
media wall: each column lists the assets it stacks (by name), and the wall **derives** its
dependencies from those names — so the producers run first and there's no `inputs` map to write.
Every tile fills its column's **width** and takes its **own height** from its media's aspect ratio
(16:9 → short, 9:16 → tall) — a natural masonry, not a fixed grid; you don't set a tile size.

```ts
assets: [
  { name: "img-coat", generator: "image", options: { src: "public/img/coat.jpg" } },
  { name: "ui-home", url: "/", generator: "screenshots", options: { fullPage: false } },
  // …enough to fill the columns…
  {
    name: "wall",
    generator: "wall",                       // no url, no inputs — derived from the tiles below
    options: {
      durationSeconds: 16,
      pan: { direction: "left", loops: 1 },
      columns: [
        { tiles: ["img-coat", "ui-home"], direction: "down",
          pulses: [{ at: 0.1, duration: 0.15, distance: 0.5 }] },
        { tiles: ["ui-home", "img-coat"], direction: "up", loops: 1, stagger: 0.4 },
        { tiles: ["img-coat", "ui-home"], stagger: 0.15 },
      ],
    },
  },
],
```

- **Motion** is a uniform *pulse* model: a column's travel = `loops` continuous periods + its
  `pulses` (each `{ at, duration, distance, easing }`, all clip-relative), rounded up to a whole
  number so it loops seamlessly. `loops` defaults to `0` (static unless a pulse moves it); `stagger`
  (0–1) phase-shifts a column so similar tiles don't line up.
- **Tile sizing:** tiles fit the column width and take their height from the media's aspect, so
  columns scroll as a masonry. `tileAspect` is only a **fallback** for faux (`test`) tiles that don't
  set their own `aspect` — real tiles ignore it.
- **Test mode:** `test: true` renders faux labeled colour boxes instead of real assets — no
  producers run and the managed server is auto-skipped, so it previews in seconds. Give a faux tile
  an `aspect` (w/h) to mirror the real tile's height. Pair with `capture: "realtime"` while
  iterating; drop both for the final render.
- **Capture modes:** `capture: "frames"` (default) steps deterministically (frame-accurate, exact
  duration, parallelized by `workers`); `capture: "realtime"` records the scene live (faster).

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

## Using it from source

Prefer the published package (`pnpm add -D auto-showcase`). To use an unreleased build —
while contributing, or to pin `main` — pick one:

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
projects).

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
or the `wall` loading its bundled scene web app), the package must be resolvable from that folder —
use option B/C above, or a `node_modules/auto-showcase` junction to this repo.

**Adding a generator:** implement the `Generator` contract in `src/generators/<id>/`,
`register()` it in `src/generators/registry.ts`, and extend the `AssetSpecInput` union +
`settings.defaults` in `src/config/define-config.ts`. No pipeline or CLI changes needed.

## License

MIT
