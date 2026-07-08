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
| `scroll-reel` | mp4 — frame-stepped scroll reels, choreographed section pans, social formats |
| `interaction` | mp4 — scripted realtime demos with a synthetic cursor, or element-focused clips |
| `screenshots` | png/jpeg full-page + element captures across named viewports |
| `wall` | mp4 — a seamless-looping media wall of your other assets and local `{ src }` files |
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
`init` detects the package manager, framework, and dev port (Next → 3000, Vite → 5173, …) and
scaffolds the config to match; when pro-visu isn't a local dependency it falls back to the JSON
config automatically. It also creates + gitignores `pro-visu/`, adds a `pro-visu` npm script, and
ensures Chromium. Re-running is safe (idempotent).

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
    defaults: {
      "scroll-reel": {
        output: {
          width: 1440,
          height: 900,
          fps: 30,
        },
      },
    },
  },
  assets: [
    {
      name: "home-reel",
      url: "/",
      generator: "scroll-reel",
    },
    {
      name: "home-shots",
      url: "/",
      generator: "screenshots",
      options: {
        viewports: [
          {
            name: "desktop",
            width: 1440,
            height: 900,
          },
          {
            name: "mobile",
            width: 390,
            height: 844,
          },
        ],
      },
    },
  ],
});
```

URL-based generators (`scroll-reel`, `interaction`, `screenshots`) take a `url`; local generators
(`wall`, `specimen`, `palette`, `palette-reel`) need none. Per-asset `options` override
`settings.defaults["<generator-id>"]`. See https://pro-visu.com/docs/generators for every option,
and https://pro-visu.com/docs/recipes for ready-made configs (social reels, tours, media walls).

## 4. Generate
```bash
pnpm exec pro-visu doctor                   # verify config + env + URLs and print the plan first
pnpm exec pro-visu generate                 # all assets (add --draft while iterating)
pnpm exec pro-visu generate --asset home-reel   # just one (repeatable)
pnpm exec pro-visu list                     # show what's in the manifest (--json for scripts)
```
Assets land in `pro-visu/<generator>/...` with metadata in `pro-visu/manifest.json` (gitignored).
Re-running replaces an asset's record by `name`.

## Capture-safe animations (esp. screenshots)
Screenshots freeze a single instant, so **JS/React-controlled animations don't capture cleanly** —
they're caught mid-flight or in their pre-animation state, leaving **blank gaps, missing sections, or
zeroed-out numbers** in the output. Disabling CSS transitions alone (e.g. Playwright's
`animations: "disabled"`) does NOT fix these, because the visible state is gated in JS, not CSS.
Common offenders:
- **Reveal-on-scroll** (fade/slide-in via IntersectionObserver) → sections stay at `opacity: 0`, so a
  full-page shot shows a large empty gap between the hero and footer.
- **Number count-ups** (animate 0 → value) → captured as `0` or a partial value.
- **Scroll-snap**, scroll-driven sequences, carousels, typewriters, parallax → caught at the wrong frame.

**Fix at the SITE level: gate every such animation behind a toggle that renders the final/settled
state, and toggle it OFF for captures.** pro-visu delivers that toggle for you via
`settings.capture`, split into two halves: `signals` into the site — a `query` param, `cookies`,
`localStorage`, and/or an `initScript` on every URL-based capture (folded into the cache key) — and
`cleanup` the tool applies itself — `hideSelectors`, `clickSelectors`, `freezeClock`,
`blockTrackers`, … — for noise the site won't remove:

```ts
settings: {
  capture: {
    signals: {
      query: { capture: "1" },
      cookies: [{ name: "pv_capture", value: "1" }],
    },
    cleanup: { hideSelectors: ["#cookie-banner"] },
  },
}
```

The site must read the signal — make reveals render visible, count-ups show their final number,
scroll-snap relax to normal flow. Build the toggle in from the start on any site you intend to
capture; it's far more reliable than trying to out-wait the animations from the capture side. A
session cookie in `capture.signals.cookies` also gets captures past a login.

## Notes
- Needs a **reachable URL or a managed server** — pro-visu won't boot a dev server unless
  `settings.server` is configured. With no managed server, `generate` probes the URLs up front and
  fails fast when nothing responds (and `pro-visu doctor` runs the same check).
- **JS-driven animations need a site-side off switch** — reveal-on-scroll, count-ups, and scroll-snap
  capture as gaps/zeros; see *Capture-safe animations* above.
- Node ≥ 18.18 + a package manager. The first generate downloads a managed Chromium (one-time,
  cached and shared across projects); ffmpeg is fetched the same way on first use.
- Unreleased / pinned build: `pnpm add -D github:pro-laico/pro-visu`
  (see https://pro-visu.com/docs/getting-started).
