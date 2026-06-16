# Handoff — VESPER media wall (EOD 2026-06-15 → morning 2026-06-16)

## TL;DR
The media wall is **built, refactored, tuned, and verified** (typecheck + 250 tests + render all green).
**Nothing from the big refactor is committed yet.** First thing in the morning: decide the commit +
push, then do a final high-res render.

---

## ⚠️ Do this first — git state
- **3 commits made this session** (on `main`): `827678d` image generator + real-content wall ·
  `fe49d15` media-wall asset + reusable storefront features · `cf6fa20` real on-model photography.
- **20 files uncommitted** = the **`scene`→`wall` refactor + motion-v2** (they're intertwined —
  same files — so commit as **one commit**). Plus a 1-line `pan` tune.
- **Verify push status:** `git status` showed `main` level with `origin/main` (the 3 commits may or
  may not be pushed). Run `git log origin/main..HEAD` to confirm; push whatever's ahead.
- Generated assets under `public/showcase/**` are **gitignored** (not committed) — correct.
- Recommended morning sequence: `git log origin/main..HEAD` → commit the working tree (one commit) →
  `git push origin main`. (Confirm before committing per the usual rule.)

---

## What exists now (this session's work)
1. **Real photography** (committed `cf6fa20`): on-model images for hero/editorial/about + all 8 products.
2. **The media wall** (`lookbook-wall`), authored entirely in `showcase.config.ts`.
   - **24 tiles, 6 columns**, real content: **12 high-res images** (via the new `image` generator) +
     **6 UI page captures** (3:4 screenshots of home/shop/PDPs/about/lookbook) + **6 motion clips**
     (cart, menu, quick-add, wishlist, size, boomerang scroll).
   - Output: **`apps/testing/public/showcase/wall/lookbook-wall.mp4`** (1920×1080).
3. **New reusable storefront features** (also tile sources): `/lookbook` route, `StatTile` (CSS
   count-up), `ProductSpecCard`, `BrandMark`, `MiniGallery` (living PDP gallery — retired the
   placeholder-thumbnail caveat), wishlist heart, newsletter focus, About "by the numbers" band.
4. **Engine changes (packages/auto-showcase):**
   - New **`image`** passthrough generator (any file → scene input).
   - New friendly **`wall`** generator; **removed** the generic `scene` generator + the
     phone/laptop/browser device-frame scenes (the `renderScene` **engine stays** — wall/specimen/
     palette-reel use it).
   - Two bug fixes: **EPERM manifest retry** (Windows) + **video cold-start `presented()`**; the wall
     renders with **`workers: 1`** (parallel frame-workers cold-start black on video-heavy walls).
   - **Motion v2** — two independent systems (see below).

## Motion — current behaviour (matches the brief)
- **System 1 — X pan:** a *slight, continuous* leftward drift (`pan: { loops:1, direction:"left",
  pulses:1, pulseDuration:5, baseDrift:0.85 }`). `loops:1` is the gentlest seamless pan.
- **System 2 — per-column Y:** each column its own speed/dir/pulse over a shared `baseDrift:0.04`,
  desynced by seeded jitter → columns move **independently** (verified: col0 ~4/6/12s, col2
  ~2.5/6.5/12s, col4 ~1.25/4/9/13.5s). Authored explicitly in `columnMotion` (6 entries).
- Net feel = whole UI drifting gently left + columns occasionally pulsing = **slow, alive wall**
  (motion profile is a steady floor + spikes, no dead stretches). ✅ verified this session.

---

## Open items / next steps
1. **Final render** — current renders are **draft (15fps)**. Do a final pass (drop `--draft`) once
   happy; **4K later** = bump tile capture resolution (image tiles are already hi-res).
2. **Tune to taste** — `columnMotion` per-column pulses + `pan` are the dials. The AI control surface
   is exactly the config now.
3. **assignTiles coverage quirk** — at 24 tiles / 6 cols, 3 cells aren't shown + s2–s4 repeat at the
   edges (static images placed there deliberately). Optional small engine fix for perfect coverage.
4. **Interaction clips** are realtime → variable length → a tiny seam at the wall wrap on those few
   tiles (images / UI / boomerang loop perfectly). Acceptable; revisit if noticed.
5. **`workers:1`** — parallel-safe fix available (loop `requestVideoFrameCallback` until
   `metadata.mediaTime` matches the seek target).
6. **Stale parked backlog** — the big comment block in `showcase.config.ts` still shows old
   `scene:"phone/laptop/browser"` examples (harmless, commented; prune when convenient).
7. **Skipped:** color/size swatch switcher (products have one colorway/photo — would be fake UX).

---

## How to render / verify
- Full build (auto-includes the 24 tile producers):
  `pnpm --filter testing exec showcase generate --asset lookbook-wall`
- Fast iterate (config/seed/motion only): add `--draft --skip-build --cache`
- Final quality: drop `--draft`.
- View in the gallery: `pnpm --filter testing dev` → `/gallery` (or open the mp4 directly).
- Tests / typecheck: `pnpm --filter auto-showcase test` · `pnpm --filter auto-showcase typecheck` ·
  `cd apps/testing && pnpm exec tsc --noEmit`.
- Bundled ffmpeg (for frame extraction / motion measurement):
  `node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/ffmpeg.exe`
- Reminder: after editing the `auto-showcase` package, `pnpm --filter auto-showcase build` so the
  linked test app picks it up.

## Key files
- `apps/testing/showcase.config.ts` — the wall + every tile producer (single control surface).
- `apps/testing/WALL-TIMELINE.md` — full timeline, motion architecture, decisions + seed logs.
- `apps/testing/SHOWCASE-PLAN.md` — program-level plan (feel guidelines, site assessment).
- `packages/auto-showcase/scene-app/src/scenes/wall-motion.ts` + `Wall.tsx` — the motion engine.
- `packages/auto-showcase/src/generators/wall/` — friendly `wall` generator.
- `packages/auto-showcase/src/generators/image/` — `image` passthrough generator.
