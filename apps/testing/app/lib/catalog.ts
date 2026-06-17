// Catalog data for the VESPER storefront (the pro-visu capture target).
// Swap a CSS placeholder for a real photo by setting `image` on a product (e.g.
// "/img/products/the-camel-coat.jpg") and dropping the file in `public/img/`.

export type Tone = "camel" | "oat" | "charcoal" | "bone" | "ink" | "cognac" | "ecru" | "loden";

/** Tonal duotones used by the placeholder until real photography is provided. */
export const TONES: Record<Tone, { from: string; to: string; ink: string }> = {
  camel: { from: "#C7AE88", to: "#A98B62", ink: "#2A2216" },
  oat: { from: "#DED4C2", to: "#C7BAA3", ink: "#3A3326" },
  charcoal: { from: "#3C3C3F", to: "#242428", ink: "#EDEBE6" },
  bone: { from: "#EFEAE0", to: "#DBD3C4", ink: "#3A3326" },
  ink: { from: "#26221E", to: "#141210", ink: "#EDEBE6" },
  cognac: { from: "#8C5C3E", to: "#6B4329", ink: "#F2E8DD" },
  ecru: { from: "#E7DFCF", to: "#D3C8B2", ink: "#3A3326" },
  loden: { from: "#5E604D", to: "#454734", ink: "#EDEBE6" },
};

export type Category = "Outerwear" | "Knitwear" | "Tailoring" | "Accessories";

export interface Product {
  slug: string;
  name: string;
  category: Category;
  price: number;
  tone: Tone;
  colorway: string;
  description: string;
  details: string[];
  /** Optional real photo. When set, the storefront renders <img> instead of the tonal placeholder. */
  image?: string;
}

export const PRODUCTS: Product[] = [
  {
    slug: "the-camel-coat",
    name: "The Camel Coat",
    category: "Outerwear",
    price: 1290,
    tone: "camel",
    colorway: "Camel",
    description:
      "A double-faced wool-and-cashmere coat cut to a clean, unstructured line. Tailored to fall from the shoulder with an easy, considered drape.",
    details: ["72% virgin wool, 28% cashmere", "Horn buttons", "Unlined, double-faced construction", "Made in Portugal"],
    image: "/img/products/the-camel-coat.jpg",
  },
  {
    slug: "cashmere-crewneck",
    name: "Cashmere Crewneck",
    category: "Knitwear",
    price: 420,
    tone: "oat",
    colorway: "Oat",
    description: "Spun from grade-A Mongolian cashmere and knitted to a substantial twelve-gauge for quiet, lasting warmth.",
    details: ["100% grade-A cashmere", "Twelve-gauge knit", "Ribbed collar, cuffs and hem", "Made in Italy"],
    image: "/img/products/cashmere-crewneck.jpg",
  },
  {
    slug: "pleated-wool-trouser",
    name: "Pleated Wool Trouser",
    category: "Tailoring",
    price: 390,
    tone: "charcoal",
    colorway: "Charcoal",
    description: "A single-pleat trouser in a dry, mid-weight wool flannel, finished with a clean tapered leg and a turned hem.",
    details: ["100% virgin wool flannel", "Single forward pleat", "Tapered leg, turned hem", "Made in Portugal"],
    image: "/img/products/pleated-wool-trouser.jpg",
  },
  {
    slug: "silk-slip-dress",
    name: "Silk Slip Dress",
    category: "Outerwear",
    price: 560,
    tone: "bone",
    colorway: "Bone",
    description: "A bias-cut slip in heavy sand-washed silk that moves with a fluid, weighted ease. Adjustable straps, French seams throughout.",
    details: ["100% sand-washed silk", "Bias cut", "Adjustable straps", "French-seamed finish"],
    image: "/img/products/silk-slip-dress.jpg",
  },
  {
    slug: "double-breasted-blazer",
    name: "Double-Breasted Blazer",
    category: "Tailoring",
    price: 890,
    tone: "ink",
    colorway: "Ink",
    description: "A softly tailored double-breasted blazer with a natural shoulder and a lightly roped sleevehead. Half-canvassed for a lived-in line.",
    details: ["Wool-mohair blend", "Half-canvas construction", "Natural shoulder", "Made in Italy"],
    image: "/img/products/double-breasted-blazer.jpg",
  },
  {
    slug: "leather-tote",
    name: "The Leather Tote",
    category: "Accessories",
    price: 740,
    tone: "cognac",
    colorway: "Cognac",
    description: "A roomy, unlined tote in vegetable-tanned leather that softens and deepens with wear. Hand-finished edges, a single interior pocket.",
    details: ["Vegetable-tanned full-grain leather", "Unlined", "Hand-painted edges", "Made in Spain"],
    image: "/img/products/leather-tote.jpg",
  },
  {
    slug: "ribbed-turtleneck",
    name: "Ribbed Turtleneck",
    category: "Knitwear",
    price: 310,
    tone: "ecru",
    colorway: "Ecru",
    description: "A fine-gauge merino turtleneck with a close, second-skin fit and a fold-over collar. Quietly essential under tailoring.",
    details: ["100% extra-fine merino", "Fine-gauge rib", "Fold-over collar", "Made in Italy"],
    image: "/img/products/ribbed-turtleneck.jpg",
  },
  {
    slug: "tailored-overshirt",
    name: "Tailored Overshirt",
    category: "Outerwear",
    price: 480,
    tone: "loden",
    colorway: "Loden",
    description: "A shirt-jacket in brushed cotton moleskin that sits between layers — light structure, patch pockets, a soft collar.",
    details: ["Brushed cotton moleskin", "Corozo buttons", "Twin patch pockets", "Made in Portugal"],
    image: "/img/products/tailored-overshirt.jpg",
  },
];

export const CATEGORIES: { name: Category; tone: Tone; blurb: string }[] = [
  { name: "Outerwear", tone: "camel", blurb: "Coats & layers" },
  { name: "Knitwear", tone: "oat", blurb: "Cashmere & merino" },
  { name: "Tailoring", tone: "ink", blurb: "Suiting & trousers" },
  { name: "Accessories", tone: "cognac", blurb: "Leather & more" },
];

/** Deterministic price formatting (no Intl dependency, for reproducible captures). */
export function formatPrice(n: number): string {
  return "$" + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function relatedProducts(slug: string, count = 4): Product[] {
  return PRODUCTS.filter((p) => p.slug !== slug).slice(0, count);
}
