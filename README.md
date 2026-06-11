# auto-showcase

A portable CLI for generating marketing/showcase assets (scroll reels — with more asset
types to come) of the websites you build. Install it into any website repo, point it at a
URL, and it writes assets into a gitignored `showcase/` folder.

> Status: **v1 / early.** Ships one generator (`scroll-reel`). The pipeline is built around
> a plugin contract so new asset types (device-framed composites via Revideo, screenshots,
> etc.) slot in without core changes.

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
