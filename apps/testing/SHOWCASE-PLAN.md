# VESPER showcase plan

A living planning doc for what we capture in [`showcase.config.ts`](./showcase.config.ts).
The config itself is the source of truth for *how* each asset is built; this doc tracks *what*
we want, *why*, and *what's decided*.

**Working rule:** every recorded video is **~10 seconds**. Start small, promote assets out of the
parked backlog one at a time as we dial them in.

---

## Feel — "Quiet & slow"

The authoring guideline for every asset (also pinned at the top of `showcase.config.ts`).

- **Pace:** unhurried. Target every clip at ~10s. Hold long on each section; never rush a scroll.
- **Easing:** gentle (`easeInOutSine` / `easeOutCubic`). No linear, no snap.
- **Motion:** at most a whisper of Ken Burns (`scaleTo ≤ 1.04`). Let the photography sit still.
- **Captions / cards:** minimal — ideally none while we set the tone. If used: restrained, in the
  brand voice ("quietly made"), never salesy.
- **Palette:** Ink `#1a1714` · Paper `#f6f3ed` · Camel `#b49a77` · Loden `#5c5e4c` · Cognac `#8a5a3c`.
  Cards/backdrops = ink bg + paper text. Cursor (interactions) = camel `#8c7355`, slow + deliberate.
- **Respect negative space;** no clutter, no UI chrome we don't mean to show.

---

## Designer's assessment of the site

What's worth showing, by section — flagged for **visual appeal** and **functionality we can actually
demonstrate**, with a 10s treatment and honest caveats. Legend: ✅ ready · ⚠️ caveat · ⏭️ skip.

### Global chrome
| Section | Appeal | Functionality | 10s idea | State |
|---|---|---|---|---|
| Mega-menu (`#menu-button` → `#menu-panel`) | 3 tidy columns + a "Featured" panel | opens on click, links hover | cursor drifts in, opens menu, holds across columns | ✅ |
| Cart drawer (`#cart-button` / `#pdp-add` → `#cart-drawer`) | clean slide-in, line items, subtotal | real add → drawer flow | add an item, drawer slides in, hold on subtotal | ✅ |
| Announcement bar / search / account | minor / decorative | search & account do nothing | — | ⏭️ |

### Home (`/`)
| Section | Appeal | Functionality | 10s idea | State |
|---|---|---|---|---|
| `#hero` | ★ real photo + serif headline + CTAs | — | hold on the photo, a whisper of Ken Burns | ✅ |
| `#values` | thin type bar | — | transition only | minor |
| `#new-arrivals` | ★ 8 real product photos | quick-add appears on hover | slow pan across the grid; or hover one card | ✅ |
| `#editorial` | ★ real 4:5 campaign + copy | — | settle on the split, slow read | ✅ |
| `#categories` | nice 4-tile layout | links to /shop | — | ⚠️ still tonal placeholders (no real imagery) |
| `#journal` | calm founder pull-quote | — | long quiet hold on the quote | ✅ (typographic) |

### Shop (`/shop`)
| Section | Appeal | Functionality | 10s idea | State |
|---|---|---|---|---|
| `#shop-head` | clean title + count | — | open on the title | ✅ |
| `.filter-bar` | looks the part (chips + sort) | chips/sort are **static** — no real filtering wired | show the look, not the behaviour | ⚠️ non-functional |
| `#shop-grid` | ★ all 8 real photos, grid-4 | quick-add on hover | slow vertical scroll through the full collection | ✅ |

### Product (`/products/the-camel-coat`)
| Section | Appeal | Functionality | 10s idea | State |
|---|---|---|---|---|
| `.pdp-gallery` | ★ main image real | thumbnails are placeholders | hold on the main image | ⚠️ thumbs not real |
| `AddToBag` (`.size-options`, `#pdp-add`) | clean | pick size → add → cart drawer | the buy flow, unhurried | ✅ best interaction |
| `.pdp-details` | tidy spec list | — | brief hold | ✅ |
| `#related` | ★ real photos | quick-add | covered by a grid scroll | ✅ |

### About (`/about`)
| Section | Appeal | Functionality | 10s idea | State |
|---|---|---|---|---|
| `#about-hero` | ★ real atelier photo + "Maison Vesper" | — | slow hold, faint zoom | ✅ |
| `#about-statement` | large, airy statement type | — | quiet hold — very on-brand | ✅ |
| `#about-pillars` | 3 clean text pillars | — | gentle pan across the three | ✅ |
| `#about-atelier` | ★ real hand-stitching photo + copy | — | settle on the split | ✅ |

### Takeaways
- **Strongest, fully-ready, no caveats:** `#hero`, `#new-arrivals`, `#editorial` (home); the
  `#shop-grid` scroll; the PDP **buy flow**; About `#about-hero` / `#about-atelier`.
- **Best functionality to show:** the **buy flow** (size → add → drawer) and the **mega-menu**.
- **Avoid for now:** `#categories` and PDP thumbnails (placeholders), and the **filter bar**
  (static — would imply filtering that doesn't work).

---

## Candidate shortlist (small scale first)

Proposed starter — three 10s clips covering *see it / browse it / buy it*. **Not yet decided.**

| # | Working name | Page | Treatment | Why |
|---|---|---|---|---|
| 1 | home hero | `/` | slow hold on `#hero` + whisper Ken Burns | the first impression, real photography |
| 2 | shop grid | `/shop` | slow scroll of `#shop-grid` | the whole collection in one breath |
| 3 | buy flow | `/products/the-camel-coat` | size → add → cart drawer | the one genuinely interactive moment |

Open question: do we want a stills (screenshots) asset in the starter, or motion only first?

---

## Decisions log

- **2026-06-15** — Feel set to **"Quiet & slow."** Every clip targets ~10s.
- **2026-06-15** — All previously-drafted assets **parked** in the backlog block of
  `showcase.config.ts`; `assets` is empty until we promote a starter set.
- **2026-06-15** — Real on-model photography added to the site (hero, editorial, about, + a photo
  per product). `#categories` tiles and PDP thumbnails remain placeholders.

## Open questions / parking lot

- Starter set: confirm the three above (or adjust).
- Should we generate real imagery for `#categories` tiles and PDP thumbnails so those sections
  become showable?
- Complex scenes (device frames, palette/type specimens) — deferred until the basics feel right.
  They live in the parked backlog.
- **Media wall** — now in active planning: see [`WALL-TIMELINE.md`](./WALL-TIMELINE.md) (hand-authored
  tile timeline) and the approved approach. We add real, reusable storefront features (lookbook route,
  StatTile, ProductSpecCard, BrandMark, new PDP/footer UX) that double as 3:4 tile sources.
