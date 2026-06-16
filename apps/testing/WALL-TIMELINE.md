# VESPER Media Wall — manual timeline

The hand-authored plan for the `lookbook-wall` asset. We fill this in **before** writing
`showcase.config.ts`; it maps 1:1 onto the wall's `inputs` (order matters) + `sceneOptions`.
See the approved approach in [`SHOWCASE-PLAN.md`](./SHOWCASE-PLAN.md) and the engine notes there.

> **This inventory is a FIRST DRAFT — edit freely.** Swap sources, reorder, change still↔video,
> retitle. Rows are intentionally interleaved (don't cluster all stills then all videos) so the
> `seed` can arrange archetypes evenly across the grid.

---

## Globals

| Field | Value |
|---|---|
| Frame | 1920×1080 (16:9) |
| fps | 30 |
| Duration | **16s** (deliberate exception to the 10s clip rule — the wall is an ambient hero loop; 16 gives CSS-loop tiles clean divisors) |
| Columns | **6** entries in the `columns` array (dial: 5 = calmer/bigger · 7 = denser, reserve for 4K) |
| gap | 8px (hairline gutter) · tileAspect 0.75 (fallback only — tiles take their media's own height) · cornerRadius 6 |
| Background | Ink `#1a1714` (gutters) — warm photos + paper-on-ink type glow |
| Motion preset | **subtle-but-alive** (b) — see presets below |
| Seed | _TBD — sweep 1–12_ |
| Distinct sources | 18 (≈10 still / 8 video) + bench alternates below |

Layout at these globals: tiles are **312px wide**, height per the media's aspect (16:9 ≈ 312×176,
9:16 ≈ 312×555, 3:4 ≈ 312×416) — a natural masonry, rows offset between columns. Loops seamlessly by
construction; each video tile must self-loop and divide 16s (use ~4s clips, or the 2s count-up).

---

## Tile inventory  (order = `inputs` insertion order)

★ = focal point we want the seed to place well.

| slot | archetype | source (existing / NEW) | still/video | what it shows | if video: motion + loop | producer pattern | producer asset |
|---|---|---|---|---|---|---|---|
| s1 | product | `/shop` `.product` camel coat | still | The Camel Coat (camel) | — | focus `.product-media` (static) | `tile-coat` |
| s2 ★ | data/stat | NEW `StatTile` (lookbook) | video | "30 / YEARS · since 1994" count-up | number ramps 0→30, 2s, infinite-alternate (8× in 16s) | focus `.stat-tile`, holdMs 16000 | `tile-stat-years` |
| s3 | editorial | `#editorial` campaign still | still | "A study in restraint" | — | focus `.editorial-media` | `tile-editorial` |
| s4 | type | NEW lookbook `.lb-wordmark` | still | VESPER lockup | — | focus `.lb-wordmark` | `tile-wordmark` |
| s5 | UI motion | `#cart-drawer` (existing) | video | cart drawer slides in, holds on subtotal | translateX 0.4s → hold; ~4s clip | focus `#cart-drawer` + actions | `tile-cart` |
| s6 | product | `/shop` `.product` crewneck | still | Cashmere Crewneck (oat) | — | focus `.product-media` | `tile-crewneck` |
| s7 | UI motion | `.product` quick-add (existing) | video | hover → quick-add slides up | hover 0.3s → hold; ~4s clip | focus `.product` + hover action | `tile-quickadd` |
| s8 | PDP-chrome | NEW `ProductSpecCard` | still | coat: name · price · spec bars | — | focus `.spec-card` | `tile-spec-coat` |
| s9 | UI motion | `.size-options` (existing PDP) | video | size chips S→M→L select | click 0.2s each; ~4s clip | focus `.size-options` + actions | `tile-size` |
| s10 ★ | product | `/shop` `.product` leather tote | still | The Leather Tote (**cognac accent**) | — | focus `.product-media` | `tile-tote` |
| s11 | UI motion | NEW PDP `.mini-gallery` | video | auto-cycling 3-image gallery | CSS `@keyframes`, 4s loop | focus `.mini-gallery`, holdMs 16000 | `tile-gallery` |
| s12 | type | `#journal` founder quote | still | "We make a little, and we make it well." | — | focus `.journal-quote` | `tile-quote` |
| s13 | UI motion | NEW `.wishlist` heart toggle | video | tap → heart fills (heartPop) | click → `@keyframes` ~3s clip | focus `.wishlist` + click | `tile-wishlist` |
| s14 | editorial | `#about-atelier` still | still | "Made by hand, made to last" | — | focus `.editorial-media` | `tile-atelier` |
| s15 | UI motion | NEW PDP `.swatch-row` switcher | video | tap swatch → hero image crossfades | click → crossfade ~4s clip | focus `.swatch-row` + click | `tile-swatchswitch` |
| s16 | type | NEW lookbook `.lb-manifesto` | still | "Made in measured quantities." | — | focus `.lb-manifesto` | `tile-manifesto` |
| s17 | UI motion | NEW footer `.signup-row` | video | focus input → underline grows → type | click+type ~4s clip | focus `.signup-row` + actions | `tile-newsletter` |
| s18 | product | `/shop` `.product` blazer | still | Double-Breasted Blazer (ink) | — | focus `.product-media` | `tile-blazer` |

**Still/video split:** 10 still · 8 video (~half). **Archetypes covered:** product (4), editorial (2),
type (3), PDP-chrome (1), data/stat (1), UI-motion (7).

### Bench / alternates (swap in as desired)
- products: silk slip dress (bone), pleated wool trouser (charcoal), ribbed turtleneck (ecru), tailored overshirt (loden)
- NEW `BrandMark` monogram (`.lb-mark`, still) · palette swatch block (`.lb-swatch`, still — rare accent)
- NEW `StatTile` static composition ("72% WOOL / 28% CASHMERE")
- `ProductSpecCard` tote variant (`tile-spec-tote`) · bag-count increment clip (`.bag-btn`)

---

## Accent / focal points
- **Rare accent (cognac):** the Leather Tote (s10) — keep isolated from other warm-brown tiles; tune seed.
- **Showpiece "alive" tile:** the count-up stat (s2) — want it landing in a mid-frame, eye-level cell.
- Keep the two editorial 4:5 stills (s3, s14) apart so the wall doesn't feel top/bottom-heavy.

## Global cadence — INTENT, not keyframes
Motion is seeded/continuous (no per-tile scripting). Record the *feel*; realize it via preset + seed.
- Overall: mostly held, quiet. A couple of columns drift slowly; the rest near-still.
- "Alive" carried by the **video tiles** (count-up ticking, cart sliding, gallery cycling) against an
  otherwise calm field — exactly the reference's trick.
- One slow whole-wall pan (panLoops 1) over the 16s.

### Motion presets (wall-level defaults; per-column entries override)
The wall-level `loops` + `pulses` apply to every column that omits its own. A track's travel =
`loops` continuous whole-clip periods + Σ(pulse `distance`), rounded UP to a whole number (the
remainder folds into the continuous scroll) so it always loops seamlessly. **`loops` defaults to 0**,
so a column is *static* unless it has a pulse or an explicit `loops` — and adding a single pulse
rounds the total up to exactly one loop (the common case).
- **(a) hushed:** mostly static (`loops:0`, no pulses); a few columns get one gentle pulse.
- **(b) subtle-but-alive (default):** `loops:0` + a per-column pulse (`distance` ~0.3–0.6) → 1 loop each.
- **(c) livelier:** `loops:1`+ and/or larger / more frequent pulses.
- Always `pan: { direction:"left", loops:1 }`. Columns scroll "down" by default; set `direction:"up"` per column where wanted.

## Pulse cadence (Chad's direction: ~2 gentle "whole-wall" moves over 16s, with small column nudges
between — not constant churn)
- Pulses are explicit and deterministic: `{ at (0..1 of clip), duration (0..1 of clip), distance
  (periods), easing }`. Cadence is authored directly — no weights/jitter/seed.
- A "strong move" = a pulse with a larger `distance` (e.g. 0.5–0.7) and `ease-in-out-strong`; a "nudge"
  = a small `distance` (~0.25). Place moments via `at`; control feel via `duration` + `easing`.
- Hold = the gaps between pulses (the track is still except during a pulse + the slow `loops` creep).
- `at` + `duration` are both clip fractions, so a pulse can't overrun the clip: if `at + duration > 1`
  the start auto-shifts back to end at the loop point (e.g. a 0.2 pulse at 0.9 starts at 0.8).

## Seed log
| seed | verdict (placement · accent position · adjacency · any repeats on-screen) |
|---|---|
| 7 | Pipeline proof (8 product stills only, draft 15fps). Layout + differential scroll + warm tonal read beautifully. |
| 7 | Full 20-source variety (draft). Reads exactly like the reference, warm/editorial. To re-sweep: the VESPER wordmark + V monogram sometimes land near each other (brand-heavy cluster) — pick a seed that separates them; keep the cognac tote + swatch apart. |

## Motion → two independent systems (current)
The wall's motion is two systems built from ONE uniform pulse primitive, so columns no longer move in
lockstep. A **pulse** is `{ at (0..1), duration (0..1 of clip), distance (periods), easing }`.
- **System 1 — X pan** (`pan: { direction, loops, pulses }`): the whole wall pans horizontally —
  `loops` continuous wraps + any pulses.
- **System 2 — per-column Y**: each entry in the `columns` array carries its own tiles AND its own
  motion (`{ tiles, direction, loops, pulses, stagger }`); omitted `loops`/`pulses` inherit the
  wall-level defaults, and an omitted `direction` defaults to "down". A track's travel = `loops`
  continuous periods + Σ(pulse distances), rounded UP to a whole number (remainder folds into the
  continuous scroll) → every track lands on its start at the clip end → seamless for ANY
  `durationSeconds`. `stagger` (0..1) adds a constant start-position shift (a fraction of a tile-set)
  so columns with similar content (e.g. the all-image top row) don't line up — it's a fixed phase
  offset, so it preserves the seam. Spread the values so neighbours don't share a phase.

### Preview / test mode
`test: true` renders every tile as a flat labeled color box instead of the real assets — and (key) it
makes the wall declare **no dependencies**, so no producers run and the wall renders in seconds. Use it
to dial in columns / motion / stagger fast, then turn it off for the real render. Tiles auto-color from
their name; `testTiles: { "<name>": { color, size, aspect } }` overrides a box's color, adds a size
caption, and sets its aspect (w/h) so the faux preview matches the real tile's height (16:9 → short,
9:16 → tall). Tiles without an `aspect` fall back to `tileAspect`.

Verified: per-column motion peaks at different times (col0 ~4/6/12s, col2 ~2.5/6.5/12s, col4
~1.25/4/9/13.5s) — independent, not "same-same".

## Refactor → friendly `wall` generator
The wall is now its own generator: `generator: "wall"` with grid + motion knobs at the top level (no
`scene: "wall"` / nested `sceneOptions`). The generic `scene` generator and the phone/laptop/browser
device-frame scenes were removed; the shared scene **engine** (`renderScene`) stays — `wall`,
`specimen`, and `palette-reel` all render through it. Also added a general `image` passthrough generator.

## Redesign → real-content tiles
Replaced the synthetic lookbook-panel tiles + low-res focus-crops with **real, high-fidelity content**:
- **12 image tiles** — the actual high-res asset photos used directly via a NEW **`image` generator**
  (passthrough: copies the source file, e.g. `public/img/products/*.jpg`, so tiles are full source
  resolution, ~864×1184, not 274px re-captures). Products ×8 + editorial + atelier + hero + about-hero.
- **6 UI page tiles** — crisp 3:4 viewport `screenshots` of the real pages (home, shop, pdp-coat,
  pdp-slip, about, lookbook), `fullPage:false`, 900×1200 @ dsf2 → 1800×2400.
- **6 clips** — real UI in motion at 900×1200: `clip-cart` (add→drawer→close), `clip-menu`,
  `clip-quickadd`, `clip-wishlist`, `clip-size`, `clip-homescroll` (boomerang, exact 4s perfect loop).
  Interaction clips return to start state to read as loops (realtime → variable length, so a tiny seam
  at the wall wrap is accepted on those few tiles).
- Wall `inputs` reordered to interleave image/UI/clip; static images sit in the edge-repeat cells
  (s2–s4) and the unshown cells (s10/s15/s20), motion clips + the cognac accent placed elsewhere.
- The `image` generator is a general, reusable addition (any static asset → scene input / manifest).

## (Earlier) lookbook-panel build (24 tiles)
- **24 distinct tiles = 6 cols × 4 rows** (fixes the 20-tile duplicate-column/skipped-tile quirk; only
  a minor residual: cells s10/s15/s20 aren't shown and s2–s4 repeat at both edge columns, so focal
  tiles are placed off those — see the inputs comment in showcase.config.ts).
- **New reusable storefront features added** (real UX + tile/asset sources):
  - `MiniGallery` — living product gallery (3 framings crossfade on a 4s CSS loop); replaces the PDP
    placeholder thumbnails and is the animated `tile-gallery`.
  - `StatTile` 2nd instance — `tile-stat-pct` (0→100% count-up).
  - `ProductSpecCard` 2nd variant — `tile-spec-crew`; plus a `care` value type panel.
  - `Wishlist` heart on product cards (toggle + `heartPop`); footer **newsletter** focus underline.
- **Skipped: color/size swatch switcher** — products have a single colorway + one photo, so swatch-
  switching the hero would be fake UX; the `MiniGallery` already delivers "the hero changes over time."
  Easy to add later if real colorway variants (+ photos) are introduced.
- Animated tiles now: `tile-stat-years` (count-up), `tile-stat-pct` (count-up), `tile-gallery`
  (crossfade) + the differential column motion. The rest are stills (the reference is mostly stills).

## Build notes
- **Producer pattern confirmed:** `scroll-reel` `focus` on `.grid .product:nth-child(n) .product-media`
  yields clean 3:4 tiles (274×366 draft; full-res at final). Primary output = the `.mp4`. ✓
- **EPERM/manifest race (FIXED):** retry-with-backoff + direct-overwrite fallback around the rename in
  `packages/auto-showcase/src/manifest/manifest.ts`. Parallel asset runs now work at default concurrency.
- **Black tiles at worker boundaries (FIXED via `workers: 1`):** with parallel frame-workers, each
  worker cold-starts its range and screenshots the seeked tile `<video>` before its frame decodes →
  black tiles every 40 frames (deterministic). `runtime.ts` now waits for a *presented* frame
  (`requestVideoFrameCallback`), but on a cold context the presented frame is still stale, so the wall
  uses `workers: 1` (sequential seeks keep videos warm → clean). Proper parallel fix (future): loop
  rVFC until `metadata.mediaTime` matches the seek target before capturing.
