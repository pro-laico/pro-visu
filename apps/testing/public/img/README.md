# Storefront imagery

The FASHION storefront ships with tasteful **tonal placeholders** so it looks art-directed
out of the box. To swap in real photography, drop files here and point the code at them — no
component changes needed.

## Product photos

1. Add the image file, e.g. `public/img/products/the-camel-coat.jpg`
2. Set `image` on that product in [`app/lib/catalog.ts`](../../app/lib/catalog.ts):

   ```ts
   { slug: "the-camel-coat", name: "The Camel Coat", /* … */ image: "/img/products/the-camel-coat.jpg" }
   ```

The product card, product page, and "you may also like" rows all pick it up automatically.
Recommended ratio **3 : 4** (portrait), e.g. 1200 × 1600.

## Hero / editorial / about imagery

Set the path in [`app/lib/media.ts`](../../app/lib/media.ts) and drop the file:

| Key            | Surface              | File (suggested)          | Ratio          |
| -------------- | -------------------- | ------------------------- | -------------- |
| `hero`         | Home hero            | `/img/hero.jpg`           | 16 : 9 (wide)  |
| `editorial`    | Home campaign split  | `/img/editorial.jpg`      | 4 : 5 (tall)   |
| `aboutHero`    | About hero           | `/img/about-hero.jpg`     | 16 : 9 (wide)  |
| `aboutAtelier` | About atelier split  | `/img/about-atelier.jpg`  | 4 : 5 (tall)   |

```ts
// app/lib/media.ts
export const MEDIA = {
  hero: "/img/hero.jpg",
  editorial: "/img/editorial.jpg",
  // …
};
```

Any key left `undefined` keeps its tonal placeholder, so you can add images one at a time.
