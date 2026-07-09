# Changelog

All notable changes to `pro-visu` are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com), and the project adheres to
[Semantic Versioning](https://semver.org).

## [Unreleased]

## [0.6.1] - 2026-07-08

A colocation and ergonomics release: everything pro-visu owns now lives in one `pro-visu/` folder,
the managed server needs no configuration, and capture cleanup can be tuned per asset.

### Added

- **Per-asset capture overrides.** `settings.capture` is global, but any asset can now override it
  with its own `capture` block, merged over the global for that asset only — so you can hide the
  cookie banner everywhere yet show it off in one hero shot. Cleanup arrays are **additive** (an
  asset's `hideSelectors` layer onto the globals), with two subtraction escapes —
  `cleanup.showSelectors` un-hides a globally-hidden element and `cleanup.unblockHosts` un-blocks a
  globally-blocked host. Booleans (`freezeClock`, `blockTrackers`, …) override, `injectCss` is
  appended, and signals merge (records by key, cookies by name). Omit a key to inherit the global.
  New export: `CaptureOverrideInput`.
- **The managed server needs no configuration.** `settings.server` can now be an empty `{}` — its
  `build` and `command` default to the project's own package scripts (`<pm> build` / `<pm> start`,
  detected from the lockfile), so pro-visu follows along with whatever those scripts do across
  npm/pnpm/yarn/bun. Change your `build`/`start` scripts and pro-visu follows automatically. Set
  `build: false` to skip the build step (already-built or dev-server targets); `command` is no
  longer required.
- **Enable, disable & group assets with `enabled`.** Every asset now takes a top-level `enabled`
  field (default `true`): set it to `false` to leave an asset out of a run without deleting or
  commenting it, or to a group string (e.g. `"quick-test"`) to tag it. Set `settings.enabled` to
  that same string to run only that group — a one-line switch between quality passes like
  `quick-test` / `full-test` / `high-quality`. `settings.enabled: false` runs nothing, `true`
  (default) runs everything not individually disabled. Explicit `--asset` selection still
  overrides the toggle, and dependencies of a running asset are always pulled in. `pro-visu doctor`
  marks which assets will run under the current setting.

### Changed (BREAKING)

- **Config and output now live in a `pro-visu/` folder.** The CLI discovers the config *inside*
  `pro-visu/` (`pro-visu/pro-visu.config.{ts,js,mjs,cjs,json}` or `.pro-visurc`) rather than the
  repo root, and `settings.outDir` now resolves relative to that folder — defaulting to `output`,
  so generated assets land in `pro-visu/output/` with their own `manifest.json`. Asset source paths
  (fonts, image `src`) and the managed-server working directory stay repo-root-relative, since they
  point into your app. The `package.json "pro-visu"` key is no longer a discovery source; an
  explicit `--config <path>` still escapes the convention. Migrate by moving your config into
  `pro-visu/` (splitting any modules under `pro-visu/config/`), gitignoring `pro-visu/output/`
  instead of `pro-visu/`, and updating any `--config` paths — or just run `pro-visu init`, which
  scaffolds the new layout.

## [0.6.0] - 2026-07-08

A surface-trim release built from a usability audit: fewer commands, fewer options, one easing
vocabulary, and site cleanup in one place — with the trimmed paths replaced by automation
(heap sizing, interrupted-run cleanup, JSON Schema refresh) instead of knobs. Every removal
fails loudly with a pointed migration hint, never silently.

### Added

- **The `interaction` generator.** Scripted realtime demos — a synthetic cursor that moves,
  clicks, hovers, and types — and element-focused clips cropped to one component, split out of
  `scroll-reel` into their own generator. `actions`, `cursor`, and `focus` work exactly as
  before; they just live under `generator: "interaction"` now, so `scroll-reel`'s options no
  longer carry a mode matrix where half the settings silently don't apply.
- **Walls take files directly.** A column tile can now be `{ src: "public/img/hero.jpg" }` — a
  local image/video used straight from disk, hashed into the cache key — instead of a separate
  passthrough asset per photo. This replaces the `image` generator.
- **Split your config across files.** Every author-facing type is now exported from `pro-visu` —
  per-generator option types (`ScrollReelOptions`, `WallOptions`, …) and their fragments
  (`WallColumnInput`, `ChoreographyStepInput`, `PulseInput`, `PaletteColorInput`, and more) —
  so settings and each asset family can live in their own modules
  (`satisfies AssetSpecInput[]`) and compose in `pro-visu.config.ts`.
- **`specimen`: a `label` block** to place and style the name label within the bottom gap area.
  `anchor` picks any of nine positions (`top-left` … `bottom-right`), `padding` insets it from the
  gap edges (`0` = flush to the rendered corner), and `size` / `weight` / `color` style the text.
  Defaults keep the label bottom-left, so existing specimens read the same.
- **`scroll-reel`: `loop: "straight"`** — a second loop style alongside `"boomerang"`: run the
  motion once, then glide straight back to the top (no retraced stops) so the clip's last frame
  lands where the first started and the output loops. Works with the default sweep,
  `choreography`, and `autoSections`; the return glide is carved out of the same clip length.

### Changed (BREAKING)

- **`scroll-reel` auto-sections skip the footer by default.** `autoSections` reels no longer force
  a final scroll to the absolute bottom, and footer elements (`<footer>`, `[role="contentinfo"]`)
  no longer count as sections — the reel ends holding on the last *content* section, since a
  footer-heavy ending is rarely the shot you want. Restore the old ending with
  `autoSections: { includeFooter: true }`.

- **Site cleanup moved to `settings.capture`** — `hideSelectors`, `injectCss`, `clickSelectors`,
  `hideScrollbars`, `pauseAnimations`, `freezeClock`, `blockTrackers`, `blockHosts`, and
  `blockResourceTypes` are no longer per-reel `scroll-reel` options. They now apply to **every**
  URL capture (scroll-reel, screenshots, interaction) from one place, which also means
  screenshots get tracker blocking and banner hiding for the first time. Migrate by moving those
  keys from a reel's `options` into `settings.capture`.
- **One easing vocabulary everywhere:** `linear`, `ease-in`, `ease-out`, `ease-in-out`
  (default), `ease-out-strong`, `ease-in-out-strong` — shared by scroll-reel travel, wall
  pulses/pan, and palette-reel crossfades (which gain the strong variants). Migrate by renaming:
  `ease-in-out-cubic`/`-quad`/`-sine` → `ease-in-out`, `ease-out-cubic` → `ease-out`,
  `ease-in-out-expo` → `ease-in-out-strong`, `ease-out-quint` → `ease-out-strong`.
- **Asset `inputs` are no longer authored.** Dependencies are always derived from options (a
  wall's column tiles); the config-level `inputs` map is gone. Migrate by deleting any `inputs`
  keys — the graph is built for you.
- **`wall`: faux-tile `size` renamed to `caption`** (it was always a caption string, never a
  size). Migrate by renaming the key in `testTiles`.
- **`screenshots`: a viewport's `height` is now required** (it previously defaulted to 900).
  Migrate by adding `height` to any viewport that omitted it.
- **`palette` / `palette-reel`: the `cmyk` field id was dropped** (a print colour model on a
  screen-capture tool). `name`, `hex`, `rgb`, `oklch`, and `hsl` remain.
- **`specimen`: the label colour moved** from `colors.label` to `label.color`. The label's colour is
  part of the label, not a glyph token. Move any `colors: { label }` to `label: { color }`.

### Removed (BREAKING)

- **`scroll-reel`: the `capture` strategy switch.** Scroll reels are now always frame-stepped —
  the deterministic, crisp, parallel path; `capture: "realtime"` (and the warnings about options
  it silently ignored) is gone. For a realtime recording of the live page — time-based hero
  animation, autoplay video — use the `interaction` generator: a `scrollTo` action reproduces a
  realtime scroll.
- **`scroll-reel`: multi-page `routes` tours.** One reel records one page. Migrate by capturing
  each route as its own scroll-reel asset and concatenating in your editor of choice.
- **`scroll-reel`: `kenBurns`, `annotations`, and `intro`/`outro` cards.** Post-production
  belongs in an editor; the generator's job is a clean, deterministic capture. Migrate by
  dropping the options and adding zooms/captions/title cards in your video editor of choice.
- **The `image` generator.** Walls take `{ src }` tiles directly (see Added). Migrate by
  deleting the passthrough assets and inlining their paths into the wall's `columns`.
- **`pro-visu reset`** — replaced by automation: the next `generate` detects an interrupted
  run's record and tears down its orphaned server/temp dirs itself.
- **`pro-visu schema` and `generate --dry-run`** — also automation/consolidation: a scaffolded
  `pro-visu.schema.json` refreshes itself on the next `generate`/`doctor` after an upgrade, and
  `doctor` now prints the resolved plan (assets, URLs, server decision).
- **`settings.maxMemoryMB`** — heavy frame-stepped plans (real walls) now re-exec with a larger
  Node heap automatically, sized from the machine's RAM. Migrate by deleting the setting.
- **The `SHOWCASE_LIVE` env alias** — use `PRO_VISU_LIVE`.

### Changed

- **The update check is dependency-free.** The `update-notifier` package (and its transitive
  tree) is gone; a ~100-line built-in check hits npm at most daily from a detached worker and
  prints the same after-command notice. `NO_UPDATE_NOTIFIER` / `--no-update-notifier` still
  opt out.
- **Internals segmented for the next contributor:** the deterministic frame recorder now lives
  under `src/recorder/`, the scene engine (serving + capture + `renderScene`, with a
  contributor README on adding scenes) under `src/scene-engine/`, and the Chromium/ffmpeg
  bootstrap under `src/binaries/`. No behavior change.
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
- **Parallel workers share one network cache per capture.** Each frame-capture worker runs an
  isolated browser context, so N workers used to download the whole site N times; now the first
  request for a URL fetches it once and the other workers replay the recorded response (only GET,
  never `Range`/event streams; falls back to the network on any miss or error).
- **Chromium launches lazily**, on the first asset that actually renders — a fully-cached rerun
  (`--cache`) never pays browser startup.
- **One in-page call per captured frame:** the scroll seek, annotation update, and content settle
  used to be up to three `page.evaluate` round-trips per frame; they now ride a single one.
- Asset content hashes are computed by streaming the file instead of reading it whole into memory.

### Fixed

- **`scroll-reel` auto-sections no longer leave a hairline of the previous section under a sticky
  header.** Sections were landed exactly flush with the measured header bottom, so sub-pixel
  rounding left a ~½px seam where the previous section's edge peeked out between the header and the
  section beneath it. Sections now land ~2px *under* the header, tucking that boundary behind it —
  the header height is still auto-measured; this only biases the landing. Applies to `autoSections`
  and choreography selector targets.
- **`scroll-reel autoSections`: `headerSelector` / `headerHeight`** — an escape hatch for pages where
  the auto-detect picks the wrong sticky header (e.g. a header that only goes `fixed` via JS on
  scroll, or a sticky promo bar that shouldn't count). `headerSelector` measures that element's
  bottom; `headerHeight` sets the inset in px directly (and wins over both the heuristic and
  `headerSelector`). Omit both to keep auto-detecting.
- **`interaction` clicks no longer scroll-jump to targets already on screen.** Every click /
  hover / type step used to instantly recentre its target with `scrollIntoView`, so a scripted
  tour stuttered with a hard cut on each step even when the element was fully visible. The
  cursor now only scrolls when the target is actually out of view — frame your scene once
  (e.g. an eased `scrollTo`) and the taps play out on a stable page.
- **`interaction` `scrollTo` a selector honors `scroll-margin-top`** — parity with native
  `scrollIntoView`, so a page with a sticky header (declared via CSS `scroll-margin-top`) keeps
  the scrolled-to element's top visible instead of hiding it under the header.
- **Walls (and video scenes) can now use parallel workers without black tiles.** Two causes fixed
  in the scene runtime: readiness never actually decoded a frame (data buffered ≠ painted), and
  the presentation wait's 250ms safety net fired before a cold decoder's first paint under
  multi-worker CPU load. Every video now warms its decoder (a real presented frame) before
  capture starts, and the wait budget is generous for presenting videos while degrading to short
  for videos that demonstrably don't present. Remove any `workers: 1` workaround from wall
  configs.
- **`screenshots` assets now hit the cache.** Their manifest records are all suffixed
  (`name-desktop`, `name-mobile`), so the cache lookup by bare asset name never matched — every
  `--cache` run recaptured all screenshots (and launched the browser to do it). The check now
  matches a spec's full record set. Cache keys also gained the asset name, so this release
  regenerates everything once.
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
- **`specimen` digits no longer get clipped at the bottom in old-style-figure fonts.** Fonts whose
  default figures are old-style (e.g. Cormorant Garamond, where 3/4/5/7/9 descend ~0.28em below
  the baseline) had those descenders cut off by the tight cap-height line box. Glyph rows now
  force lining figures (`font-variant-numeric: lining-nums`), so digits sit on the baseline in
  every font. Relatedly documented: a custom `characterPool` with lowercase needs `leading` raised
  to ~1, or its descenders (g j p q y) are clipped by the default `0.78`.

### Upgrade notes

1. Move any `hideSelectors` / `blockTrackers` / `freezeClock` / … keys from `scroll-reel`
   options into `settings.capture`.
2. Change assets using `actions` / `cursor` / `focus` to `generator: "interaction"`.
3. Replace `image` assets with `{ src }` tiles in the wall's `columns`, and delete any `inputs`
   maps and `settings.maxMemoryMB`.
4. Rename easings to the new vocabulary and `testTiles.*.size` to `caption`.
5. Drop `kenBurns` / `annotations` / `intro` / `outro` from reels (re-create in your editor).
6. Every remaining mismatch fails validation with a pointed hint — run `pro-visu doctor` to see
   them all at once.

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
