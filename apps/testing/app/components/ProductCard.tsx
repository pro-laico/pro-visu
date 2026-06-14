"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/app/components/cart";
import { Placeholder } from "@/app/components/Placeholder";
import { formatPrice, type Product } from "@/app/lib/catalog";

export function ProductCard({ product, id }: { product: Product; id?: string }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  function onAdd() {
    add({ slug: product.slug, name: product.name, price: product.price, colorway: product.colorway });
    setAdded(true);
  }

  const href = `/products/${product.slug}`;

  return (
    <article className="product" id={id}>
      <div className="product-media">
        <Link href={href} className="product-link" aria-label={product.name}>
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt={product.name} />
          ) : (
            <Placeholder tone={product.tone} ratio="3 / 4" />
          )}
        </Link>
        <button type="button" className="quick-add" onClick={onAdd}>
          {added ? "Added to bag" : "Add to bag"}
        </button>
      </div>
      <div className="product-meta">
        <h3 className="product-name">
          <Link href={href}>{product.name}</Link>
        </h3>
        <p className="product-colorway">{product.colorway}</p>
        <p className="product-price">{formatPrice(product.price)}</p>
      </div>
    </article>
  );
}
