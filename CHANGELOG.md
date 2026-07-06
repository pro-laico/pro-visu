# Changelog

All notable changes to `pro-visu` are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com), and the project adheres to
[Semantic Versioning](https://semver.org).

## [Unreleased]

### Added

- **`specimen`: a `label` block** to place and style the name label within the bottom gap area.
  `anchor` picks any of nine positions (`top-left` … `bottom-right`), `padding` insets it from the
  gap edges (`0` = flush to the rendered corner), and `size` / `weight` / `color` style the text.
  Defaults keep the label bottom-left, so existing specimens read the same.

### Changed (BREAKING)

- **`specimen`: the label colour moved** from `colors.label` to `label.color`. The label's colour is
  part of the label, not a glyph token. Move any `colors: { label }` to `label: { color }`.

### Changed

- **Frame-capture workers now share one run-wide budget and size themselves to free memory.**
  Previously every frame-stepped asset picked its worker count as if it owned the machine, so
  `settings.concurrency` multiplied it into far more supersampled Chromium contexts + encoders
  than the machine could hold — the main cause of memory exhaustion on busy machines. The auto
  worker count is now also bounded by available system memory, and all captures in a run draw
  from a single context budget (excess chunks queue for a free slot). Output is unchanged; an
  explicit `workers` still tiles the frames into that many segments.
- **Parallel frame encoders no longer oversubscribe CPU threads:** each worker's x264 encoder is
  capped to its share of the cores instead of every encoder spawning ~1.5× cores of threads.
- **The low-memory watchdog now watches system memory too.** It previously sampled only the Node
  heap, which cannot see Chromium or ffmpeg — the processes that actually exhaust RAM. The run now
  also stops gracefully (keeping already-finished assets) when system memory nears exhaustion.
- **`screenshots` writes each shot to disk as it is captured** instead of holding every viewport's
  buffers in memory until the end — fullPage PNGs at `deviceScaleFactor: 2` run tens of MB each.
- Asset content hashes are computed by streaming the file instead of reading it whole into memory.

### Fixed

- **A failed capture no longer leaks its ffmpeg encoder.** A mid-capture error (navigation flake,
  screenshot timeout) left the encoder blocked on its stdin pipe for the rest of the run, so
  failures across a long run accumulated orphaned ffmpeg processes. The encoder is now torn down
  on the failure path.
- **A failed worker now stops its sibling workers** at the next frame boundary instead of letting
  them keep rendering segments that would be thrown away.
- **Per-frame settle waits can no longer pile up in the page.** The in-page settle is now capped
  in-page at `settleMaxMs` (alongside the existing Node-side cap), so a stuck image decode stops
  stacking pending protocol calls for the rest of a segment.
- The live dashboard no longer re-renders on every captured frame — progress commits at
  whole-percent steps, the display's own resolution.

## [0.5.0] - 2026-07-02

A usability-focused release built from a CLI audit. Failures now surface early and
actionably, a new `pro-visu doctor` checks your whole setup before you generate, and `init`
scaffolds a config that matches your project. It also unifies the option-naming surface behind
one convention — a breaking change for existing configs, but one that fails loudly with a
migration hint rather than silently.

### One naming convention (BREAKING)

Three ad-hoc conventions are replaced by one rule: **every author-facing time option is
milliseconds with an `Ms` suffix, every easing name is kebab-case, and every responsive capture
list is `viewports`.** Old names fail validation with a pointed migration message (including the
×1000 unit conversions), so nothing breaks silently — `pro-visu doctor` and
`pro-visu generate --dry-run` check a migrated config without capturing anything.

- **`scroll-reel`:** `duration` → `durationMs` (already ms — rename only). Easings are kebab-case:
  `easeInOutCubic` → `ease-in-out-cubic`, `easeInOutQuad` → `ease-in-out-quad`,
  `easeOutCubic` → `ease-out-cubic`, `easeInOutSine` → `ease-in-out-sine`,
  `easeInOutExpo` → `ease-in-out-expo`, `easeOutQuint` → `ease-out-quint` (covers `easing`,
  choreography-step `easing`, and `kenBurns.easing`).
- **`screenshots`:** `breakpoints` → `viewports` (same shape) — now matching `scroll-reel`, so one
  shared list can drive both.
- **`wall`:** `durationSeconds` → `durationMs`, now in milliseconds (`16` → `16000`); pulse
  `duration` → `span` (same 0..1 clip fraction) — `duration` no longer means three different things
  across the tool.
- **`specimen`:** `durationSeconds` → `durationMs` (×1000); pulse `duration` (was seconds) →
  `durationMs` in milliseconds (`0.8` → `800`).
- **`palette-reel`:** `holdSeconds` → `holdMs` (`2` → `2000`), `transitionSeconds` →
  `transitionMs` (`0.7` → `700`), `durationSeconds` → `durationMs` (×1000).

**Migrate by** suffixing every renamed time value with `Ms` (multiplying the seconds-based ones by
1000), kebab-casing any camelCase easing, renaming `breakpoints` arrays to `viewports`, and
renaming wall pulse `duration` to `span`. See **Upgrade notes**.

### `pro-visu doctor` and `generate --dry-run`

Two ways to validate before spending time on a capture. **`pro-visu doctor`** checks the whole
setup without generating anything — Node version, config discovery + validation (every asset's
generator options and the dependency graph), Chromium, ffmpeg, and whether the asset URLs actually
respond — and exits non-zero when something needs fixing, so it doubles as a CI gate.
**`generate --dry-run`** validates the config and prints the resolved plan (selected assets, URLs,
server decision, quality, concurrency) without capturing.

### Project-aware `init`

`init` now detects the package manager, framework, and dev port (Next.js → 3000, Vite → 5173, an
explicit `--port` flag in the dev script, …) and scaffolds the config to match, so the first
`generate` is far more likely to hit a running site. When pro-visu isn't installed as a project
dependency (npx / global use), `init` automatically falls back to the dependency-free JSON config,
since the TS template's `import` wouldn't resolve.

### Added

- **`list --json`** — print the manifest as JSON for scripts and CI.
- **ffmpeg download progress + offline hints** — the one-time ~80 MB fetch logs quartile progress
  instead of sitting silent, and connection-level failures explain the `FFMPEG_BINARIES_URL` /
  `FFMPEG_BIN` escape hatches (Chromium failures point at `HTTPS_PROXY` /
  `PLAYWRIGHT_DOWNLOAD_HOST`).
- **Typo suggestions** — unknown `--asset` names, unknown generator ids, and typo'd
  `settings.defaults` keys get a "did you mean …?" hint.

### Changed

- **Options are validated before any heavy work** — every selected asset's options are parsed up
  front (config mistakes fail in seconds, not after a browser install or site build), and option
  errors print as pointed `options.path: message` bullets instead of a raw JSON dump.
- **URL pre-flight** — with no managed server configured, `generate` probes the asset URLs first, so
  a dev server that isn't running fails with one actionable message instead of a per-asset
  Playwright navigation error.
- **Early errors are visible on interactive terminals** — messages emitted before the live dashboard
  mounts (missing Chromium/ffmpeg, unknown `--asset`, invalid options) previously vanished on a TTY;
  they now always print.
- **Strict `settings` and config root** — a misspelled key (e.g. `concurrancy`, `setttings`) is
  rejected instead of being silently ignored, and `settings.defaults` keys that match no generator
  are flagged.
- **`settings.defaults` merges deeply** — an asset that sets one field of a nested object (e.g.
  `kenBurns.scaleTo`) keeps the default's other fields instead of replacing the whole object; arrays
  and primitives still replace wholesale.
- **Unknown commands fail** — `pro-visu bogus` exits 1 with a pointed message instead of silently
  printing help; an invalid `--concurrency` value errors instead of being silently ignored.
- **`PRO_VISU_LIVE`** replaces `SHOWCASE_LIVE` for forcing the live dashboard on/off
  (`SHOWCASE_LIVE` still works as a legacy alias).

### Docs

- New [Troubleshooting](https://pro-visu.com/docs/troubleshooting) page (unreachable URLs, proxies,
  CI sandboxing, out-of-memory, cookie-based auth capture).
- Renamed `scroll-reel`'s `capture: "frames" | "realtime"` docs section to **"Capture strategy"** so
  it stops colliding with `settings.capture` ("capture mode").
- Getting-started now calls out that the config URL must match a running site; READMEs no longer
  claim ffmpeg is bundled (it's fetched on first use since 0.4.0) and the package README documents
  `settings.capture`.

### Upgrade notes

1. Update your config for the renames above (or run `pro-visu doctor` — it reports each one with the
   exact fix and unit conversion).
2. If you scripted around `SHOWCASE_LIVE`, switch to `PRO_VISU_LIVE` (the old name still works).
3. Nothing to reinstall — Chromium and ffmpeg are unchanged.

## [0.4.0] - 2026-06-29

### Added

- **Capture mode (`settings.capture`)** — per-capture toggles applied to every URL-based asset so a
  site can render a clean, settled snapshot (animations finished, no cookie banner, no chat widget)
  while keeping that behavior for real users. Delivered four ways, so a site reads whichever fits its
  rendering model: a `query` param appended to every URL, `cookies` (SSR-readable and persisted across
  in-app navigation — best for multi-route reels), seeded `localStorage`, and an `initScript` run
  before the page's own scripts. The toggles are folded into the cache key, so changing them
  re-captures. Available on both the typed `defineConfig` path and the JSON config (with schema
  autocomplete).
- **Generator option types exported** — `Palette`, `PaletteReel`, and `Image` option types are now
  part of the public API alongside the existing generators.

### Changed

- **ffmpeg is fetched on demand, not bundled** — dropped the `ffmpeg-static` dependency. The static
  ffmpeg binary is now downloaded into a shared cache on first use (mirroring how managed Chromium is
  fetched), so installing `pro-visu` no longer trips pnpm's build-script approval in consumer repos.

### Fixed

- **`prepareScroll` can't hang a capture** — the image-decode and `fonts.ready` waits are now bounded,
  so a never-settling lazy image no longer stalls a capture indefinitely.

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
