# auto-showcase

A portable CLI for generating marketing/showcase assets (scroll reels, responsive
screenshots — with more asset types to come) of the websites you build. Install it into any
website repo, point it at a URL, and it writes assets into a gitignored `showcase/` folder.

> Status: **v1 / early.** Generators: `scroll-reel` (Playwright recording → mp4) and
> `screenshots` (responsive full-page + element captures). The pipeline is built around a
> plugin contract so new asset types (e.g. device-framed composites via Revideo) slot in
> without core changes.

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

## Commands

| Command | What it does |
|---|---|
| `showcase init` | Scaffold config, create + gitignore the output dir, ensure Chromium |
| `showcase generate [--asset <name>]` | Run generators per config; writes assets + `manifest.json` |
| `showcase list` | Show generated assets recorded in the manifest |

## Development

```bash
pnpm install
pnpm build      # tsup -> dist/
pnpm test       # vitest
```

## License

MIT
