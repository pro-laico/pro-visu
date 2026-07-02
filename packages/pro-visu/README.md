# pro-visu

A portable CLI for generating marketing/showcase assets (scroll reels, responsive
screenshots, media walls — with more asset types to come) of the websites you build. Install it
into any website repo, point it at a URL, and it writes assets into a gitignored `pro-visu/`
folder.

> Status: **0.4** (pre-1.0; the option surface may still shift). Generators: `scroll-reel` (deterministic frame-stepped recording → mp4 — scroll
> reels, choreographed tours, scripted interaction, social formats and more), `screenshots`
> (responsive full-page + element captures), `wall` (a seamless-looping media wall of your
> assets), `image` (register a file for reuse), plus `specimen`/`palette`/`palette-reel`. The
> pipeline is a plugin contract, so new asset types slot in without core changes.

> Requires Node ≥ 18.18. The first run downloads a managed Chromium and a static ffmpeg (both
> cached and shared across projects) — no global installs required.

## Install & usage

Two ways to run it — same `pro-visu` CLI, same generators. They differ only in how you install it
and author config:

| | **Dev dependency** (recommended) | **Global / `npx`** (no install) |
|---|---|---|
| Install | `pnpm add -D pro-visu` | `npm i -g pro-visu`, or just `npx pro-visu …` |
| Config | TS `pro-visu.config.ts` (`defineConfig`) — or JSON | JSON `pro-visu.config.json` |
| Editor help | Full TypeScript checking + autocomplete + hover docs | Autocomplete + validation + hover docs from a generated JSON Schema |
| Version | Pinned in your lockfile → you and CI build identical assets | Floating (npx fetches latest; pin with `pro-visu@x.y.z`) |
| Best for | A repo you own, and CI pipelines | One-off captures, trying it out, throwaway scripts |

> **Why a TS config needs the dev-dependency:** `pro-visu.config.ts` does
> `import { defineConfig } from "pro-visu"`, which must resolve from your project's
> `node_modules` — both to type-check *and* to run. A JSON config has no import, so it works in every
> mode, and the generated `pro-visu.schema.json` gives editors the same autocomplete, validation, and
> hover docs. So: want the typed config and reproducible pins → dev dependency; want zero install →
> global/npx with a JSON config.

### As a dev dependency (recommended)

```bash
pnpm add -D pro-visu     # or: npm i -D pro-visu  /  yarn add -D pro-visu
npx pro-visu init             # scaffolds pro-visu.config.ts, gitignores pro-visu/, ensures a browser
# edit pro-visu.config.ts, start your site (or use a deployed URL), then:
npx pro-visu generate
```

### Globally or via `npx` (no install)

```bash
npx pro-visu init --json     # scaffolds pro-visu.config.json + pro-visu.schema.json
# edit pro-visu.config.json, then:
npx pro-visu generate
```

…or install once with `npm i -g pro-visu` and drop the `npx`. `init --json` points the config at
the generated schema (`"$schema": "./pro-visu.schema.json"`), so your editor gives full autocomplete +
validation with no project dependency — refresh it after upgrading the tool with `pro-visu schema`.

## Config

`pro-visu init` writes a `pro-visu.config.ts`. It has two sections — `settings`
(repo-level CLI behavior) and `assets` (what to generate):

```ts
import { defineConfig } from "pro-visu";

export default defineConfig({
  settings: {
    outDir: "pro-visu",
    concurrency: 2,
    browser: { headless: true },
    defaults: { "scroll-reel": { width: 1440, height: 900, fps: 30 } },
  },
  assets: [
    { name: "home-reel", url: "https://your-site.com", generator: "scroll-reel" },
  ],
});
```

Config is discovered in multiple formats: `pro-visu.config.{ts,js,mjs,cjs,json}`,
`.pro-visurc`, or a `pro-visu` key in `package.json`. Use `--config <path>` to override.

**Capture mode** (`settings.capture`) lets a site render a clean, settled snapshot for the camera
only — animations finished, no cookie banner, no chat widget — while keeping the real behaviour
for visitors. The signal is delivered as query params, cookies, localStorage, and/or an init
script; the site reads whichever fits its rendering model. (A session cookie also carries auth
for login-gated pages.) See the [settings docs](https://pro-visu.com/docs/configuration/settings#capture).

Prefer JSON (or running via `npx`/global)? `pro-visu init --json` writes the same config as
`pro-visu.config.json` plus a `pro-visu.schema.json`, wired up with `"$schema": "./pro-visu.schema.json"`
so your editor still autocompletes and validates every field. `pro-visu schema` regenerates that
schema (run it after upgrading the tool).

## Generators

Each asset picks a `generator`. Defaults live under `settings.defaults["<generator-id>"]`
and are merged beneath each asset's own `options`.

| Generator | Output | Key options |
|---|---|---|
| `scroll-reel` | mp4 of the site (frame-stepped by default) — scroll reels, choreographed tours, interaction demos | `width`/`height`/`fps`/`durationMs`/`easing` plus `capture`, `choreography`, `autoSections`, `kenBurns`, `loop`, clean-capture, `colorScheme`/`viewports`, `aspect`, `outputs`, `intro`/`outro`, `annotations`, `actions`, `focus`, `routes` — see [Recording reels in depth](#recording-reels-in-depth-scroll-reel) |
| `screenshots` | png/jpeg page + element captures per viewport | `viewports[]`, `fullPage`, `format`, `elements[]`, `deviceScaleFactor` |
| `wall` | mp4 media wall — columns of your assets, each scrolling on its own, looping seamlessly | `columns[]` (tiles + per-column motion), `pulses`, `loops`, `pan`, `gap`/`tileAspect`/`cornerRadius`, `stagger`, `test` |
| `image` | passthrough — registers an existing image file as an asset (e.g. a wall tile) | `src`, `fileName` |
| `specimen` / `palette` / `palette-reel` | type specimen / colour palette (still + reel) | see the [docs](https://pro-visu.com/docs) |

```ts
assets: [
  { name: "home-reel", url: "https://your-site.com", generator: "scroll-reel" },
  {
    name: "home-shots",
    url: "https://your-site.com",
    generator: "screenshots",
    options: {
      viewports: [
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

> Every option has hover docs in `pro-visu.config.ts` — the authoring types are generated from
> the validation schema, so the editor always matches what the tool accepts.

### Capture strategy

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

- `easing` — `linear`, `ease-in-out-cubic`, `ease-in-out-quad`, `ease-out-cubic`, `ease-out-quint`, `ease-in-out-sine`, `ease-in-out-expo`.
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
      durationMs: 16000,
      pan: { direction: "left", loops: 1 },
      columns: [
        { tiles: ["img-coat", "ui-home"], direction: "down",
          pulses: [{ at: 0.1, span: 0.15, distance: 0.5 }] },
        { tiles: ["ui-home", "img-coat"], direction: "up", loops: 1, stagger: 0.4 },
        { tiles: ["img-coat", "ui-home"], stagger: 0.15 },
      ],
    },
  },
],
```

- **Motion** is a uniform *pulse* model: a column's travel = `loops` continuous periods + its
  `pulses` (each `{ at, span, distance, easing }`, all clip-relative), rounded up to a whole
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
| `pro-visu init` | Scaffold config (detecting your framework/package manager/dev port), create + gitignore the output dir, ensure Chromium. `--json` scaffolds a dependency-free JSON config + JSON Schema (auto-selected when pro-visu isn't a local dependency) |
| `pro-visu generate [--asset <name>]` | Run generators per config; writes assets + `manifest.json` |
| `pro-visu doctor` | Check the setup — Node, config + asset options, Chromium, ffmpeg, URL reachability — without generating |
| `pro-visu list [--json]` | Show generated assets recorded in the manifest |
| `pro-visu schema [--out <path>]` | Write a JSON Schema for `pro-visu.config.json` (editor autocomplete); re-run after upgrading to refresh it |
| `pro-visu reset` | Clean up orphaned processes/temp from an interrupted run |

`generate` flags: `--draft` (faster, lower-fidelity iteration), `--cache` (skip assets whose
inputs+options are unchanged), `--skip-server` (use an already-running site), `--skip-build`
(keep the managed server but skip its build), `--dry-run` (validate + print the plan only),
`--concurrency`, `--verbose`. A managed server
(`settings.server`) can build → start → capture → stop the site automatically so the npm script
is just `pro-visu generate`. See the [CLI docs](https://pro-visu.com/docs/cli) for the
full flag list.

The CLI checks npm at most once a day and, if a newer version is out, prints an upgrade notice
after the command finishes. It's best-effort and non-blocking, and stays quiet in CI and piped
output; disable it with `NO_UPDATE_NOTIFIER=1` or `--no-update-notifier`.

## Using an unreleased build (from source)

The published package covers the modes above. To use an **unreleased** build — while contributing,
or to pin `main` — pick one:

**A — From this GitHub repo (simplest):**
```bash
pnpm add -D github:pro-laico/pro-visu
```
pnpm builds it on install (via the `prepare` script), so the `pro-visu` binary is ready.

**B — From a local clone with `pnpm link` (best while iterating on the tool):**
```bash
# in the pro-visu repo
pnpm install && pnpm build && pnpm link --global
# in your website repo
pnpm link --global pro-visu
```
Re-run `pnpm build` in the tool repo after changes; the link picks them up.

**C — As a local `file:` dependency (pinned path):**
```bash
pnpm -C /path/to/pro-visu install && pnpm -C /path/to/pro-visu build
# then in your website repo's package.json:
#   "devDependencies": { "pro-visu": "file:/path/to/pro-visu" }
pnpm install
```

Then, in your website repo:
```bash
npx pro-visu init        # scaffolds pro-visu.config.ts, gitignores pro-visu/, installs Chromium
npx pro-visu generate    # point a target at a deployed URL or a localhost you've started
```

The first run downloads a Chromium for Playwright (one-time, cached and shared across
projects).

## Developing pro-visu

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
printf '{ "assets": [ { "name": "demo", "url": "https://example.com", "generator": "scroll-reel" } ] }' > pro-visu.config.json
node /path/to/pro-visu/dist/cli/index.js generate --cwd . --config pro-visu.config.json
```
To exercise the real consumer path (a TS `pro-visu.config.ts` that imports `defineConfig`,
or the `wall` loading its bundled scene web app), the package must be resolvable from that folder —
use option B/C above, or a `node_modules/pro-visu` junction to this repo.

**Adding a generator:** implement the `Generator` contract in `src/generators/<id>/`,
`register()` it in `src/generators/registry.ts`, and extend the `AssetSpecInput` union +
`settings.defaults` in `src/config/define-config.ts`. No pipeline or CLI changes needed.

## License

MIT
