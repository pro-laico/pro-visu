// Central registry of art-direction imagery for the storefront.
//
// To add a real photo: drop the file into `public/img/`, then set its path here.
// Every surface that references the key swaps from the tonal placeholder to the photo.
// (Product photography lives on each product's `image` field in catalog.ts instead.)

export const MEDIA = {
  /** Home hero — landscape, ~16:9, e.g. "/img/hero.jpg" */
  hero: "/img/hero.jpg" as string | undefined,
  /** Home editorial / campaign — portrait, ~4:5, e.g. "/img/editorial.jpg" */
  editorial: "/img/editorial.jpg" as string | undefined,
  /** About hero — landscape, ~16:9, e.g. "/img/about-hero.jpg" */
  aboutHero: "/img/about-hero.jpg" as string | undefined,
  /** About atelier — portrait, ~4:5, e.g. "/img/about-atelier.jpg" */
  aboutAtelier: "/img/about-atelier.jpg" as string | undefined,
};
