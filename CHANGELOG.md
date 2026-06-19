# Changelog

All notable changes to `pro-visu` are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com), and the project adheres to
[Semantic Versioning](https://semver.org).

## [0.3.1] - 2026-06-18

### Fixed

- **`scroll-reel` honors sticky/fixed headers** — `autoSections` (and `choreography` scroll-to-selector)
  now pull each section target up by the height of a pinned header, so a scrolled-to section lands just
  below the header instead of being clipped underneath it. Auto-detected (no config); a page with no
  sticky/fixed header is unaffected.

## [0.3.0] - 2026-06-18

### Added

- **Update notifications** — the CLI checks npm at most once a day (in a detached background process)
  and prints an install-mode-aware upgrade notice after a command finishes. Best-effort and
  non-blocking; quiet in CI, non-TTY output, and on the dev build. Opt out with `NO_UPDATE_NOTIFIER`
  or `--no-update-notifier`.
- **Dependency-free JSON config** — use the tool via `npx`/global with a `pro-visu.config.json` and
  no project dependency. `pro-visu init --json` scaffolds the JSON config plus a matching
  `pro-visu.schema.json`, and a new `pro-visu schema` command (re)generates that schema from the
  installed tool — so a JSON config gets the same editor autocomplete + validation (including
  per-generator `options`) as the typed `defineConfig` path.

## [0.2.0] - 2026-06-17

First public release — a portable CLI that generates marketing/showcase assets of
any website. Install it into a repo, point it at a URL, and it writes assets into a
gitignored `pro-visu/` folder. Pre-1.0: the option surface may still shift.

### Added

- **`scroll-reel` generator** — deterministic, frame-stepped recording to mp4 (byte-identical
  run-to-run, supersampled, parallelized across workers). Covers scroll reels, choreographed
  section tours, auto-section detection, Ken Burns, boomerang loops, scripted interaction with a
  synthetic cursor, single-element focus, multi-page route tours, clean-capture (tracker/animation
  blocking, clock freezing), variants (color-scheme × viewport matrix), social reframing
  (`9:16`/`1:1`), extra outputs (`gif`/`webp`/`poster`), and intro/outro cards + annotations.
- **`screenshots` generator** — responsive full-page and element captures per breakpoint.
- **`wall` generator** — a seamless-looping media wall that composites your other assets into
  columns, each scrolling on its own with a uniform pulse-based motion model; dependencies are
  derived from the tile names (no `inputs` map). Includes a `test` preview mode.
- **`image` generator** — passthrough that registers an existing file as a reusable asset (e.g. a
  wall tile).
- **`specimen`, `palette`, `palette-reel` generators** — type specimen and colour palette
  (still + reel), rendered through the bundled scene engine.
- **CLI** — `init`, `generate` (with `--draft`/`--cache`/`--skip-server`/`--skip-build`/
  `--concurrency`/`--asset`), `list`, and `reset`; a live Ink dashboard; an optional managed
  server that can build → start → capture → stop the target site automatically.
- **Config** — `defineConfig` with `settings` + `assets`, discovered via
  `pro-visu.config.{ts,js,mjs,cjs,json}`, `.pro-visurc`, or a `package.json` key; authoring types
  generated from the validation schema.
- **Zero global installs** — managed Chromium downloaded on first run (cached and shared across
  projects); ffmpeg bundled via `ffmpeg-static`.

### Packaging

- npm packaging metadata, MIT license, CI (typecheck + test + build), and a tag-driven release
  workflow using npm Trusted Publishing (OIDC) with provenance.
