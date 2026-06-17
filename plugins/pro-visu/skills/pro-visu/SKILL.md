---
name: pro-visu
description: Set up and run pro-visu in a project to generate marketing/showcase assets of a website — scroll-reel videos, responsive screenshots, media walls, and type/colour specimens. Use when the user wants to showcase a site, create a reel / screenshots / portfolio capture, or scaffold and run a pro-visu config for the project they're working in.
---

# Setting up pro-visu

`pro-visu` ("For Show") is a CLI that captures a website by URL and writes showcase assets into a
gitignored `pro-visu/` folder. Your job with this skill: install pro-visu, write a working
`pro-visu.config` for the project at hand, and generate.

- **Docs:** https://pro-visu.com/docs · **CLI reference:** https://pro-visu.com/docs/cli

**Generators:**
| id | output |
|---|---|
| `scroll-reel` | mp4 — scroll reels, choreographed tours, scripted interactions, social formats |
| `screenshots` | png/jpeg full-page + element captures across named breakpoints |
| `wall` | mp4 — a seamless-looping media wall composited from your other assets |
| `image` | passthrough — registers an existing image file as an asset (e.g. a wall tile) |
| `specimen` | mp4 — a looping type specimen from a font file |
| `palette` / `palette-reel` | png / mp4 — a colour palette (still / animated reveal) |

## 1. Install
```bash
pnpm add -D pro-visu     # or: npm i -D pro-visu / yarn add -D pro-visu
```
For one-offs, skip the install and prefix commands with `npx` (e.g. `npx pro-visu init`).

## 2. Scaffold
```bash
pnpm exec pro-visu init          # typed pro-visu.config.ts
pnpm exec pro-visu init --json   # dependency-free JSON config + JSON Schema (for npx / global use)
```
`init` writes the config, creates + gitignores `pro-visu/`, adds a `pro-visu` npm script, and ensures
Chromium. Re-running is safe (idempotent).

## 3. Configure for THIS project
Edit `pro-visu.config.ts`. Two decisions:

- **Where the site runs.** Use a deployed URL, a localhost the user has already started, OR set
  `settings.server` so pro-visu builds → starts → captures → stops the site itself — e.g.
  `{ build: "npm run build", command: "npm start", port: 3101 }`. With a managed server, relative
  asset `url`s (e.g. `/shop`) resolve against it and an omitted `url` captures the root.
- **What to capture.** Each `assets` entry names a `generator`. A solid starting set:

```ts
import { defineConfig } from "pro-visu";

export default defineConfig({
  settings: {
    outDir: "pro-visu",
    // server: { build: "npm run build", command: "npm start", port: 3101 },
    defaults: { "scroll-reel": { width: 1440, height: 900, fps: 30 } },
  },
  assets: [
    { name: "home-reel", url: "/", generator: "scroll-reel" },
    {
      name: "home-shots",
      url: "/",
      generator: "screenshots",
      options: {
        breakpoints: [
          { name: "desktop", width: 1440, height: 900 },
          { name: "mobile", width: 390, height: 844 },
        ],
      },
    },
  ],
});
```

URL-based generators (`scroll-reel`, `screenshots`) take a `url`; local generators (`wall`, `image`,
`specimen`, `palette`, `palette-reel`) need none. Per-asset `options` override
`settings.defaults["<generator-id>"]`. See https://pro-visu.com/docs/generators for every option,
and https://pro-visu.com/docs/recipes for ready-made configs (social reels, tours, media walls).

## 4. Generate
```bash
pnpm exec pro-visu generate                 # all assets (add --draft while iterating)
pnpm exec pro-visu generate --asset home-reel   # just one (repeatable)
pnpm exec pro-visu list                     # show what's in the manifest
```
Assets land in `pro-visu/<generator>/...` with metadata in `pro-visu/manifest.json` (gitignored).
Re-running replaces an asset's record by `name`.

## Notes
- Needs a **reachable URL or a managed server** — pro-visu won't boot a dev server unless
  `settings.server` is configured.
- Node ≥ 18.18 + a package manager. The first generate downloads a managed Chromium (one-time,
  cached and shared across projects); ffmpeg is bundled.
- Unreleased / pinned build: `pnpm add -D github:pro-laico/pro-visu`
  (see https://pro-visu.com/docs/getting-started).
