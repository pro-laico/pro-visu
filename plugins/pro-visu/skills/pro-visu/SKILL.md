---
name: pro-visu
description: Set up and run pro-visu in a project to generate marketing/showcase assets of a website — scroll-reel videos, scripted interaction demos, responsive screenshots, media walls, and type/colour specimens. Use when the user wants to showcase a site, create a reel / interaction demo / screenshots / portfolio capture, or scaffold and run a pro-visu config for the project they're working in.
---

# Setting up pro-visu

`pro-visu` ("For Show") is a CLI that captures a website by URL and writes showcase assets into a
gitignored `pro-visu/output/` folder. Everything pro-visu owns lives under a `pro-visu/` folder:
the config (`pro-visu/pro-visu.config.ts`), any modules it's split into (`pro-visu/config/`), and
output (`pro-visu/output/`). Your job with this skill: install pro-visu, write a working
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
pnpm exec pro-visu init          # typed pro-visu/pro-visu.config.ts
pnpm exec pro-visu init --json   # dependency-free JSON config + JSON Schema (for npx / global use)
```
`init` detects the package manager, framework, and dev port (Next → 3000, Vite → 5173, …) and
scaffolds the config to match; when pro-visu isn't a local dependency it falls back to the JSON
config automatically. It also creates + gitignores `pro-visu/output/`, adds a `pro-visu` npm script,
and ensures Chromium. Re-running is safe (idempotent).

## 3. Configure for THIS project
Edit `pro-visu/pro-visu.config.ts`. Two decisions:

- **Where the site runs.** Use a deployed URL, a localhost the user has already started, OR set
  `settings.server` so pro-visu builds → starts → captures → stops the site itself. `server: {}`
  is enough — `build`/`command` default to the project's own `<pm> build` / `<pm> start` scripts
  (detected from the lockfile), so it follows along with whatever those do. Override a field only
  when the setup differs (e.g. `command: "next start -p 4000"`, or `build: false` to skip building).
  With a managed server, relative asset `url`s (e.g. `/shop`) resolve against it (default port
  3101) and an omitted `url` captures the root.
- **What to capture.** Each `assets` entry names a `generator`. A solid starting set:

```ts
import { defineConfig } from "pro-visu";

export default defineConfig({
  settings: {
    outDir: "output", // relative to pro-visu/ → renders into pro-visu/output/
    // server: {}, // build → `<pm> build`, start → `<pm> start` (port 3101); override only if needed
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

**Enable / disable / group assets.** Every asset takes a top-level `enabled` (default `true`): set
`false` to leave it out of a run without deleting it, or a group string (e.g. `"quick"`) to tag it.
Flip `settings.enabled` to that string to run only that group — a one-line switch between quality
passes (`quick` / `full` / …); `true` runs all-but-disabled, `false` runs none. `--asset <name>`
still overrides the toggle, and a running asset's dependencies come along regardless. `pro-visu
doctor` marks which assets will run.

```ts
settings: { enabled: "quick" },   // run only the "quick" group
assets: [
  { name: "hero-quick", url: "/", generator: "scroll-reel", enabled: "quick" },
  { name: "hero-full",  url: "/", generator: "scroll-reel", enabled: "full", options: { output: { fps: 60 } } },
  { name: "wip",        url: "/pricing", generator: "screenshots", enabled: false },   // never runs
]
```

## 4. Generate
```bash
pnpm exec pro-visu doctor                   # verify config + env + URLs and print the plan first
pnpm exec pro-visu generate                 # all assets (add --draft while iterating)
pnpm exec pro-visu generate --asset home-reel   # just one (repeatable)
pnpm exec pro-visu list                     # show what's in the manifest (--json for scripts)
```
Assets land in `pro-visu/output/<generator>/...` with metadata in `pro-visu/output/manifest.json` (gitignored).
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
- Unreleased / pinned build: build the package from a clone and add it as a `file:` dependency (or
  `pnpm link` it). A plain `github:pro-laico/pro-visu` install has no binary — the repo is a
  monorepo and the package lives in the `packages/pro-visu` subdir. See
  https://pro-visu.com/docs/getting-started.
