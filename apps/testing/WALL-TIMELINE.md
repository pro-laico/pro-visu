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
| Columns | **6** (dial: 5 = calmer/bigger · 7 = denser, reserve for 4K) |
| Padding | 8px (hairline gutter) · tileAspect 0.75 (3:4) · cornerRadius 6 |
| Background | Ink `#1a1714` (gutters) — warm photos + paper-on-ink type glow |
| Motion preset | **subtle-but-alive** (b) — see presets below |
| Seed | _TBD — sweep 1–12_ |
| Distinct sources | 18 (≈10 still / 8 video) + bench alternates below |

Layout at these globals: tiles **312×416px**, **~18 visible** (6 cols × ~3 rows). Loops seamlessly
by construction; each video tile must self-loop and divide 16s (use ~4s clips, or the 2s count-up).

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

### Motion presets (set in `sceneOptions`)
- **(a) hushed:** `pulses:3, pulseDuration:1.8, baseDrift:0.03, pulseVariance:0.4, scrollLoopsMin:1, scrollLoopsMax:1`
- **(b) subtle-but-alive (default):** `pulses:5, pulseDuration:1.4, baseDrift:0.06, pulseVariance:0.55, scrollLoopsMin:1, scrollLoopsMax:2`
- **(c) livelier:** `pulses:7, pulseDuration:1.0, baseDrift:0.12, pulseVariance:0.7, scrollLoopsMin:1, scrollLoopsMax:3`
- Always `panLoops:1, panDirection:"left", alternate:true`.

## Motion log (Chad's direction: ~2 strong "whole-wall" moves over 16s, gentler, with small column
nudges between — not the constant churn)
- New `pulseWeights` sceneOption (exposed in the engine) gives deterministic cadence control.
- Current: `panLoops:0` (no constant pan) · `pulses:4` · `pulseWeights:[1.7,0.3,1.7,0.3]` (strong @t≈2,10;
  nudge @t≈6,14) · `pulseDuration:2.2` · `baseDrift:0.04`. Measured peaks: strong ~50, nudge ~27, held ~3.
- Dials: strong gentler → raise `pulseDuration` or lower `scrollLoopsMax`; nudges tinier → widen weights
  (e.g. `[1.8,0.2,...]`); reposition moments → reorder weights; livelier → raise `baseDrift`.

## Seed log
| seed | verdict (placement · accent position · adjacency · any repeats on-screen) |
|---|---|
| 7 | Pipeline proof (8 product stills only, draft 15fps). Layout + differential scroll + warm tonal read beautifully. |
| 7 | Full 20-source variety (draft). Reads exactly like the reference, warm/editorial. To re-sweep: the VESPER wordmark + V monogram sometimes land near each other (brand-heavy cluster) — pick a seed that separates them; keep the cognac tote + swatch apart. |

## Final build (24 tiles)
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
