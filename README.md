<div align="center">

# pro-visu (For Show)

**Turn the websites you build into marketing & showcase assets (scroll reels, screenshots, media walls, and type/colour specimens) from a single config. Works well with letting ai take the wheel.**

[![npm](https://img.shields.io/npm/v/pro-visu.svg)](https://www.npmjs.com/package/pro-visu)
[![license](https://img.shields.io/npm/l/pro-visu.svg)](LICENSE)

[Documentation](https://pro-visu.com/docs) · [npm](https://www.npmjs.com/package/pro-visu)

</div>

---

**pro-visu** is a portable CLI for showing off the websites you build. Point it at a URL, whether a
local dev server or a deployed site, and it captures **scroll reels, responsive screenshots, looping
media walls, and type/colour specimens**, all from one `pro-visu.config.ts`. Output is deterministic
(byte-identical run-to-run) and crisp, written into a gitignored `pro-visu/` folder that's ready to
drop into a portfolio, a landing-page hero, a social post, a launch thread, or a README (like this one).

## Output Examples

**These are full clips, and most generators loop seamlessly.** Press play on any of them.

#### `interaction` · search demo

Typed, submitted, and edited queries, using the text-input actions (`type` / `erase` / `press`).

https://github.com/user-attachments/assets/4deef562-3fa2-4b03-9390-1969fc9c8bcc

#### `interaction` · cross-page tour

A synthetic cursor drives your real UI in one continuous take across pages: home → shop → The Edit → about → back home.

https://github.com/user-attachments/assets/3ca5e8c5-5aa8-48e0-a723-c1fc4945dd7a

#### `scroll-reel` · scroll reels of any page

Frame-stepped, supersampled, seamless.

https://github.com/user-attachments/assets/9a84d6aa-f433-4f41-8b52-40bbe5809f45

#### `wall` · looping media walls

Producer tiles (phone-sized interaction clips and campaign stills) composited into one loop.

https://github.com/user-attachments/assets/08d7331a-5995-4662-9580-95dc5d6bda74

#### `specimen` · type specimens from any font file

An accent-led recipe where colour, not letters, carries the motion. One of many specimen recipes.

https://github.com/user-attachments/assets/59cac500-462f-4a4b-911a-f1af9383b147

#### `palette-reel` · colour-palette reveals

A palette revealed one swatch at a time.

https://github.com/user-attachments/assets/a067fde2-c398-43b7-a84b-1ff1dbf65cca

…plus responsive **screenshots** (full-page and per-element, at every breakpoint) and social **9:16
reframes**. See the [generator docs](https://pro-visu.com/docs/generators) for the full set.

## Getting started

In your website's repo:

```bash
pnpm add -D pro-visu     # or: npm i -D pro-visu
npx pro-visu init        # scaffolds a config file, gitignore the output dir, ensure browser availability
npx pro-visu generate    # capture the assets in your config
```

Prefer no install? Use a dependency-free JSON config via `npx`:

```bash
npx pro-visu init --json
npx pro-visu generate
```

> Requires Node ≥ 18.18. The first run downloads a managed Chromium and a static ffmpeg (both
> cached and shared across projects), so no global installs are required.

## Documentation

Full generator and option reference, recipes, and configuration: **[pro-visu.com/docs](https://pro-visu.com/docs)**.

---

<sub>This repository is a pnpm + Turborepo monorepo; the library lives in [`packages/pro-visu`](packages/pro-visu/README.md). Contributions welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed.</sub>
