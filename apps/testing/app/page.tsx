import Link from "next/link";
import { ProductCard } from "@/app/components/ProductCard";
import { Placeholder } from "@/app/components/Placeholder";
import { CATEGORIES, PRODUCTS } from "@/app/lib/catalog";
import { MEDIA } from "@/app/lib/media";

const VALUES = ["Responsible Wool", "Made in Europe", "Considered Quantities", "Lifetime Repairs"];

export default function Home() {
  const arrivals = PRODUCTS.slice(0, 8);

  return (
    <main>
      <section id="hero" className="hero">
        <div className="hero-media">
          <Placeholder tone="camel" ratio="16 / 9" src={MEDIA.hero} alt="" />
        </div>
        <div className="hero-overlay">
          <p className="eyebrow eyebrow-light">Autumn / Winter 2026</p>
          <h1 className="hero-title">
            Quiet luxury,
            <br />
            considered.
          </h1>
          <p className="hero-sub">
            A wardrobe of essentials cut from the finest European mills — made in measured quantities, made to last.
          </p>
          <div className="hero-cta">
            <Link href="/shop" className="btn btn-light">
              Shop the collection
            </Link>
            <Link href="/about" className="link-underline link-underline-light">
              Discover the house
            </Link>
          </div>
        </div>
      </section>

      <section id="values" className="values">
        {VALUES.map((v) => (
          <span className="value" key={v}>
            {v}
          </span>
        ))}
      </section>

      <section id="new-arrivals" className="section">
        <div className="section-head">
          <p className="eyebrow">New Arrivals</p>
          <h2 className="section-title">The Autumn Edit</h2>
          <Link href="/shop" className="link-underline section-head-link">
            View all
          </Link>
        </div>
        <div className="grid grid-4">
          {arrivals.map((p, i) => (
            <ProductCard key={p.slug} product={p} id={i === 0 ? "feature-card" : undefined} />
          ))}
        </div>
      </section>

      <section id="editorial" className="editorial">
        <div className="editorial-media">
          <Placeholder tone="loden" ratio="4 / 5" src={MEDIA.editorial} alt="" />
        </div>
        <div className="editorial-copy">
          <p className="eyebrow">The Campaign</p>
          <h2 className="editorial-title">A study in restraint</h2>
          <p className="editorial-text">
            Photographed in northern Portugal, our Autumn collection returns to the house essentials — the coat, the
            crewneck, the trouser — reworked in heavier, longer-lasting cloth.
          </p>
          <Link href="/shop" className="btn btn-outline">
            Explore the lookbook
          </Link>
        </div>
      </section>

      <section id="categories" className="section">
        <div className="section-head section-head-center">
          <p className="eyebrow">Ready-to-Wear</p>
          <h2 className="section-title">Shop by category</h2>
        </div>
        <div className="grid grid-4">
          {CATEGORIES.map((c) => (
            <Link href="/shop" className="category-tile" key={c.name}>
              <Placeholder tone={c.tone} ratio="3 / 4" />
              <div className="category-label">
                <span className="category-name">{c.name}</span>
                <span className="category-blurb">{c.blurb}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section id="journal" className="journal">
        <p className="eyebrow">From the Journal</p>
        <blockquote className="journal-quote">
          “We make a little, and we make it well. Nothing here is designed to be replaced next season.”
        </blockquote>
        <p className="journal-attr">— Hélène Vesper, Founder</p>
      </section>
    </main>
  );
}
