import { TheEdit } from "@/app/components/TheEdit";
import { CATEGORIES, PRODUCTS } from "@/app/lib/catalog";
import { ShopBrowser } from "@/app/components/ShopBrowser";

export const metadata = {
  title: "The Collection — FASHION",
  description: "Autumn / Winter 2026 ready-to-wear.",
};

export default function Shop() {
  return (
    <main>
      <section id="shop-head" className="page-head">
        <p className="eyebrow">Autumn / Winter 2026</p>
        <h1 className="page-title">The Collection</h1>
        <p className="page-sub">{PRODUCTS.length} pieces — outerwear, knitwear, tailoring and accessories.</p>
      </section>

      <ShopBrowser products={PRODUCTS} categories={CATEGORIES.map((c) => c.name)} />

      <TheEdit />
    </main>
  );
}
