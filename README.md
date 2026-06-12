# auto-showcase

A portable CLI for generating marketing/showcase assets (scroll reels, responsive
screenshots, device-framed videos — with more asset types to come) of the websites you
build. Install it into any website repo, point it at a URL, and it writes assets into a
gitignored `showcase/` folder.

> Status: **v1 / early.** Generators: `scroll-reel` (Playwright recording → mp4),
> `screenshots` (responsive full-page + element captures), and `device-frame` (the capture
> composited into a browser-window mockup via Revideo). The pipeline is a plugin contract,
> so new asset types slot in without core changes.

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
| `scroll-reel` | mp4 of a smooth top-to-bottom scroll | `width`, `height`, `fps`, `duration`, `easing`, `waitForSelector` |
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
or `device-frame` resolving its bundled Revideo project), the package must be resolvable from
that folder — use option B/C above, or a `node_modules/auto-showcase` junction to this repo.

**Adding a generator:** implement the `Generator` contract in `src/generators/<id>/`,
`register()` it in `src/generators/registry.ts`, and extend the `AssetSpecInput` union +
`settings.defaults` in `src/config/define-config.ts`. No pipeline or CLI changes needed.

## License

MIT
