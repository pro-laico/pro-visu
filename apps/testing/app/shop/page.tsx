import { ProductCard } from "@/app/components/ProductCard";
import { CATEGORIES, PRODUCTS } from "@/app/lib/catalog";

export const metadata = {
  title: "The Collection — VESPER",
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

      <section id="shop-grid" className="section section-flush">
        <div className="filter-bar">
          <div className="filter-chips">
            <button type="button" className="chip is-active">
              All
            </button>
            {CATEGORIES.map((c) => (
              <button type="button" className="chip" key={c.name}>
                {c.name}
              </button>
            ))}
          </div>
          <button type="button" className="sort">
            Sort: Featured
          </button>
        </div>

        <div className="grid grid-4">
          {PRODUCTS.map((p, i) => (
            <ProductCard key={p.slug} product={p} id={i === 0 ? "feature-card" : undefined} />
          ))}
        </div>
      </section>
    </main>
  );
}
