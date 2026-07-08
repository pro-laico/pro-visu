"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/app/components/ProductCard";
import type { Category, Product } from "@/app/lib/catalog";

// Client-side shop grid with a search field that filters ON SUBMIT (Enter), not per keystroke — a
// stable target for the interaction generator's `type` / `erase` / `press` actions (see the search
// demo clip). `input` is what's being typed; `query` is the last submitted term the grid filters by.
export function ShopBrowser({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      q === ""
        ? products
        : products.filter((p) => `${p.name} ${p.category} ${p.colorway}`.toLowerCase().includes(q)),
    [products, q],
  );

  return (
    <section id="shop-grid" className="section section-flush">
      <div className="filter-bar">
        <div className="search-field">
          <svg className="search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" strokeLinecap="round" />
          </svg>
          <input
            id="search-input"
            type="search"
            className="search-input"
            placeholder="Search the collection"
            aria-label="Search the collection"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Filter only on submit: Enter commits the typed term; nothing updates per keystroke.
              if (e.key === "Enter") {
                e.preventDefault();
                setQuery(input);
              }
            }}
          />
        </div>
        <div className="filter-chips">
          <button type="button" className="chip is-active">
            All
          </button>
          {categories.map((c) => (
            <button type="button" className="chip" key={c}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <p className="search-status" aria-live="polite">
        {q === "" ? `${results.length} pieces` : `${results.length} result${results.length === 1 ? "" : "s"} for “${query.trim()}”`}
      </p>

      {results.length === 0 ? (
        <p className="search-empty">No pieces match your search. Try “coat”, “cashmere”, or “silk”.</p>
      ) : (
        <div id="results" className="grid grid-4">
          {results.map((p, i) => (
            <ProductCard key={p.slug} product={p} id={i === 0 ? "feature-card" : undefined} />
          ))}
        </div>
      )}
    </section>
  );
}
