# testing — VESPER storefront

A sample target website + harness for **pro-visu**: it's both the site the generators
capture and the viewer for the results. The site is **VESPER**, a fictional upscale fashion
house (outerwear, knitwear, tailoring) — a realistic ecommerce surface to exercise every generator.

```bash
pnpm --filter testing dev        # run the storefront at http://localhost:4310
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
- `app/about/page.tsx` — the house / brand story (also the `/about` route the tour visits).
- `app/gallery/page.tsx` — reads `public/pro-visu/manifest.json` to preview generated assets.
- `app/components/` — shared `Header` (nav mega-menu + slide-in cart drawer), `Footer`,
  `ProductCard`, `AddToBag`, `Placeholder`, and the `cart` context.
- `app/lib/catalog.ts` — products, categories, tones. `app/lib/media.ts` — hero/editorial imagery.

### Stable hooks for capture

The site keeps stable selectors so `pro-visu.config.ts` can choreograph interactions:

- `#menu-button` → opens the nav mega-menu `#menu-panel` (links `#menu-panel a`)
- `#cart-button` → opens the cart drawer `#cart-drawer`
- `#feature-card` → the first product card; `#feature-card button` is its **Add to bag**
- routes `/`, `/shop`, `/products/the-camel-coat`, `/about` for the multi-page tour

### Adding real assets

The storefront uses tonal placeholders until you provide photography — see
[`public/img/README.md`](public/img/README.md) for exactly where each image goes.

## Harness

- `pro-visu.config.ts` — a managed-server config exercising the generators/features (scroll reels,
  screenshots, scene, palette, scripted menu + cart interactions, element focus,
  multi-page tour); output goes to `public/pro-visu/` (gitignored) so Next serves it.
- `scripts/check.mjs` — manifest/output validation.
