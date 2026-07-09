# testing — FASHION storefront

A sample target website + harness for **pro-visu**: it's both the site the generators
capture and the viewer for the results. The site is **FASHION**, a fictional upscale fashion
house (outerwear, knitwear, tailoring) — a realistic ecommerce surface to exercise every generator.

```bash
pnpm --filter testing dev        # run the storefront at http://localhost:3400
pnpm --filter testing generate   # build+start the site, generate assets into public/pro-visu
pnpm --filter testing check      # assert every generated asset exists with sane metadata
```

Then open `/gallery` (`pnpm --filter testing dev`) to view the generated assets.

## The site

- `app/page.tsx` — home: editorial hero, values bar, **New Arrivals** grid, campaign split,
  shop-by-category, and a journal quote.
- `app/shop/page.tsx` — the collection listing (filter bar + product grid).
- `app/products/[slug]/page.tsx` — product detail with size selector, add-to-bag, and related items
  (`generateStaticParams` over the catalog).
- `app/about/page.tsx` — the house / brand story.
- `app/lookbook/page.tsx` — a brand board built for capture: stable-id 3:4 panels
  (`#lb-wordmark`, `#lb-editorial`, `#lb-spec-coat`, `#lb-swatch`, `#lb-quote`) that the focus
  clips crop into standalone tiles.
- `app/gallery/page.tsx` — reads `public/pro-visu/showcase/manifest.json` to preview generated assets.
- `app/components/` — shared `Header` (nav mega-menu + slide-in cart drawer), `Footer`,
  `ProductCard`, `AddToBag`, `Placeholder`, the `cart` context, and more.
- `app/lib/catalog.ts` — products, categories, tones. `app/lib/media.ts` — hero/editorial imagery.

### Stable hooks for capture

The site keeps stable selectors so `pro-visu.config.ts` can choreograph interactions:

- `#menu-button` → opens the nav mega-menu `#menu-panel` (links `#menu-panel a`)
- `#cart-button` → opens the cart drawer `#cart-drawer` (`.drawer-close` closes it)
- `#feature-card` → the featured product card; `.quick-add` is its quick add-to-bag
- `#pdp-add` → the PDP add-to-bag; `.size-options button` → the size chips
- `#shop-grid .product` → shop cards; `.product-media` / `.wishlist` per card
- `#edit` → the shop page's tap-to-browse "The Edit" module; `.edit-thumb` buttons swap the
  `#edit-stage` visual (the docs' interaction examples). The thumbs sit on one row so scripted
  taps never scroll-jump between options.
- `#hero`, `#editorial` → home sections for focus crops; `#lb-*` → lookbook panels
- routes `/`, `/shop`, `/products/<slug>`, `/about`, `/lookbook`

### Adding real assets

The storefront uses tonal placeholders until you provide photography — see
[`public/img/README.md`](public/img/README.md) for exactly where each image goes.

## Harness

- `pro-visu.config.ts` — a managed-server config exercising the generators/features (scroll reels,
  screenshots, media wall, palettes, type specimens, scripted interactions, element focus);
  output goes to `public/pro-visu/` (gitignored) so Next serves it. It's split
  into modules under `showcase/` (brand constants, settings, one file per asset family) — the
  split-config pattern the docs recommend.
- `pro-visu.docs.config.ts` — the curated set of example clips/stills embedded in the docs.
- `scripts/check.mjs` — manifest/output validation.
