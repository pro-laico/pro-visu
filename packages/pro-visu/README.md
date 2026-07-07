# pro-visu

A portable CLI for generating marketing/showcase assets (scroll reels, responsive
screenshots, media walls — with more asset types to come) of the websites you build. Install it
into any website repo, point it at a URL, and it writes assets into a gitignored `pro-visu/`
folder.

> Status: **pre-1.0** (the option surface may still shift). Generators: `scroll-reel`,
> `interaction`, `screenshots`, `wall`, `specimen`, `palette`, `palette-reel` — see the
> [Generators](#generators) table. The pipeline is a plugin contract, so new asset types slot in
> without core changes.

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

> A TS config needs the dev-dependency (`import { defineConfig } from "pro-visu"` must resolve
> from `node_modules`); a JSON config has no import, so it works in every mode.

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

…or install once with `npm i -g pro-visu` and drop the `npx`.

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

The config doesn't have to be one file. Every author-facing type is exported (generator option
types plus their fragments — `WallColumnInput`, `ChoreographyStepInput`, `PaletteColorInput`, …),
so a growing showcase can keep settings and each asset family in their own modules
(`satisfies AssetSpecInput[]`) and compose them in `pro-visu.config.ts`. See
[Splitting the config](https://pro-visu.com/docs/configuration#splitting-the-config).

**Capture mode** (`settings.capture`) makes every URL capture clean and settled — in two halves.
Signals INTO the site (query params, cookies, localStorage, an init script) let it render for
the camera; cleanup BY the tool (hide/click selectors, injected CSS, tracker blocking, a frozen
clock) suppresses what the site won't remove itself. Applied to every URL-based asset. (A
session cookie also carries auth for login-gated pages.) See the
[settings docs](https://pro-visu.com/docs/configuration/settings#capture).

Prefer JSON (or running via `npx`/global)? `pro-visu init --json` writes the same config as
`pro-visu.config.json` plus a `pro-visu.schema.json`, wired up with `"$schema": "./pro-visu.schema.json"`
so your editor still autocompletes and validates every field. The schema refreshes itself — after
an upgrade, the next `generate`/`doctor` rewrites it to match the installed version.

## Generators

Each asset picks a `generator`. Defaults live under `settings.defaults["<generator-id>"]`
and are merged beneath each asset's own `options`.

| Generator | Output | Key options |
|---|---|---|
| `scroll-reel` | mp4 of the site (frame-stepped) — scroll reels, choreographed section pans, social formats | `width`/`height`/`fps`/`durationMs`/`easing` plus `choreography`, `autoSections`, `loop`, `colorScheme`/`viewports`, `aspect`, `outputs` — see [Recording reels in depth](#recording-reels-in-depth-scroll-reel) |
| `interaction` | mp4 — scripted realtime demos with a synthetic cursor, or a clip cropped to one component | `actions[]`, `cursor`, `focus` |
| `screenshots` | png/jpeg page + element captures per viewport | `viewports[]`, `fullPage`, `format`, `elements[]`, `deviceScaleFactor` |
| `wall` | mp4 media wall — columns of your assets (and local `{ src }` files), each scrolling on its own, looping seamlessly | `columns[]` (tiles + per-column motion), `pulses`, `loops`, `pan`, `gap`/`tileAspect`/`cornerRadius`, `stagger`, `test` |
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

`scroll-reel` is the workhorse, and it does one thing: record a page scrolling. Every capture is
**frame-stepped**: it drives a virtual clock, screenshots each frame, and pipes them to ffmpeg —
so output is frame-accurate, crisp (supersampled by `deviceScaleFactor`), parallelized across
`workers`, and **byte-identical run-to-run**. Every option below is a `scroll-reel` option.

> Every option has hover docs in `pro-visu.config.ts` — the authoring types are generated from
> the validation schema, so the editor always matches what the tool accepts.

### Frame rendering

| Option | Meaning |
|---|---|
| `workers` | Parallel render contexts (auto-picked from cores + free memory). |
| `frameFormat` | Intermediate frame format: `"jpeg"` (default) or `"png"` (lossless). |

Site cleanup (hide the cookie banner, block trackers, freeze the clock) lives in
`settings.capture`, applied to every URL capture. For a **realtime** recording of the live page
(time-based hero animation, autoplay video, scripted cursors) use the `interaction` generator.

### Motion

```ts
options: {
  // pause-on-section tour: scroll to a target (0..1, "NN%", or a selector) and hold
  choreography: [
    { to: "#hero", holdMs: 1200 },
    { to: "#features", holdMs: 1500 },
    { to: "100%", durationMs: 1000 },
  ],
  loop: "boomerang",             // play forward then back → seamless loop
}
```

- `easing` — the shared vocabulary: `linear`, `ease-in`, `ease-out`, `ease-in-out` (default),
  `ease-out-strong`, `ease-in-out-strong`.
- `choreography: [{ to, durationMs?, holdMs?, easing? }]` — replaces the single sweep with an
  authored sequence (`to` = a `0..1` number, an `"NN%"` string, or a CSS selector to bring into view).
- `autoSections: true | { minHeightFraction?, selector?, holdMs?, durationMs?, maxSections?, constantVelocity? }`
  — auto-detect the page's sections and pan/hold through them within a fixed `durationMs` budget.
- `loop: "none" | "boomerang"`.
- Per-frame settling: `settlePerFrame` (default on; off in `--draft`) waits for fonts + in-view
  images each frame; bounded by `settleMaxMs`.

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

### Scripted interaction & element focus (the `interaction` generator)

```ts
{ name: "search-demo", url: "https://your-site.com", generator: "interaction",
  options: {
    cursor: { color: "#e91e63" },
    actions: [
      { do: "click", selector: "#menu-button" },
      { do: "hover", selector: ".dropdown a:first-child" },
      { do: "type", selector: "input[type=search]", text: "shoes" },
    ],
  },
}
```

- `actions: [{ do: "move" | "click" | "hover" | "type" | "scrollTo" | "wait", selector?, x?, y?, text?, to?, durationMs?, holdMs? }]`
  drives a scripted tour with a synthetic `cursor: { show?, size?, color? }`. Always records
  **realtime** (interactions and their animations are time-based).
- `focus: { selector, padding?, actions?, holdMs? }` — capture a single component (optionally trigger
  it first), cropped to its box.

## Media wall & composition

Assets can depend on other assets — the dependency map is always **derived**, never authored.
The **`wall`** generator composites assets into a seamless media wall: each column lists the
tiles it stacks — other assets by name (their producers run first) and/or local files directly
via `{ src }`.
Every tile fills its column's **width** and takes its **own height** from its media's aspect ratio
(16:9 → short, 9:16 → tall) — a natural masonry, not a fixed grid; you don't set a tile size.

```ts
assets: [
  { name: "ui-home", url: "/", generator: "screenshots", options: { fullPage: false } },
  // …enough to fill the columns…
  {
    name: "wall",
    generator: "wall",                       // no url — dependencies derived from the tiles below
    options: {
      durationMs: 16000,
      pan: { direction: "left", loops: 1 },
      columns: [
        { tiles: [{ src: "public/img/coat.jpg" }, "ui-home"], direction: "down",
          pulses: [{ at: 0.1, span: 0.15, distance: 0.5 }] },
        { tiles: ["ui-home", { src: "public/img/coat.jpg" }], direction: "up", loops: 1, stagger: 0.4 },
        { tiles: [{ src: "public/img/coat.jpg" }, "ui-home"], stagger: 0.15 },
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
| `pro-visu doctor` | Check the setup — Node, config + asset options, Chromium, ffmpeg, the resolved plan, URL reachability — without generating |
| `pro-visu list [--json]` | Show generated assets recorded in the manifest |

`generate` flags: `--draft` (faster, lower-fidelity iteration), `--cache` (skip assets whose
inputs+options are unchanged), `--skip-server` (use an already-running site), `--skip-build`
(keep the managed server but skip its build), `--concurrency`, `--verbose`. Interrupted-run
cleanup and the JSON Schema refresh happen automatically on the next run. A managed server
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
pnpm build              # clean + tsup -> dist/ + vite build of the scene app
pnpm typecheck          # tsc --noEmit (package + scene app)
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
