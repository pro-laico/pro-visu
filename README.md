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

#### Scroll reels of any page: frame-stepped, supersampled, seamless

<div align="center">
  <video src="https://github.com/pro-laico/pro-visu/raw/main/apps/docs/videos/docs-home.mp4" controls muted playsinline width="700">
    <a href="https://github.com/pro-laico/pro-visu/raw/main/apps/docs/videos/docs-home.mp4">▶ Watch the scroll reel</a>
  </video>
</div>

#### Scripted interaction demos: a synthetic cursor drives your real UI

<div align="center">
  <video src="https://github.com/pro-laico/pro-visu/raw/main/apps/docs/videos/docs-browse.mp4" controls muted playsinline width="700">
    <a href="https://github.com/pro-laico/pro-visu/raw/main/apps/docs/videos/docs-browse.mp4">▶ Watch the cross-page tour</a>
  </video>
  <br /><sub>One continuous take across pages: home → shop → The Edit → about → back home.</sub>
</div>

<div align="center">
  <video src="https://github.com/pro-laico/pro-visu/raw/main/apps/docs/videos/docs-search.mp4" controls muted playsinline width="700">
    <a href="https://github.com/pro-laico/pro-visu/raw/main/apps/docs/videos/docs-search.mp4">▶ Watch the search demo</a>
  </video>
  <br /><sub>Typed, submitted, and edited queries, using the text-input actions (<code>type</code> / <code>erase</code> / <code>press</code>).</sub>
</div>

#### Media walls that composite your assets into a seamless loop

<div align="center">
  <video src="https://github.com/pro-laico/pro-visu/raw/main/apps/docs/videos/lookbook-wall.mp4" controls muted playsinline width="700">
    <a href="https://github.com/pro-laico/pro-visu/raw/main/apps/docs/videos/lookbook-wall.mp4">▶ Watch the media wall</a>
  </video>
  <br /><sub>Producer tiles (phone-sized interaction clips and campaign stills) composited into one loop.</sub>
</div>

#### Type specimens from any font file

<div align="center">
  <video src="https://github.com/pro-laico/pro-visu/raw/main/apps/docs/videos/docs-spec-neon.mp4" controls muted playsinline width="700">
    <a href="https://github.com/pro-laico/pro-visu/raw/main/apps/docs/videos/docs-spec-neon.mp4">▶ Watch the type specimen</a>
  </video>
  <br /><sub>An accent-led recipe where colour, not letters, carries the motion. One of many specimen recipes.</sub>
</div>

#### Colour-palette reveals

<div align="center">
  <video src="https://github.com/pro-laico/pro-visu/raw/main/apps/docs/videos/colors-reel.mp4" controls muted playsinline width="700">
    <a href="https://github.com/pro-laico/pro-visu/raw/main/apps/docs/videos/colors-reel.mp4">▶ Watch the palette reel</a>
  </video>
</div>

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
