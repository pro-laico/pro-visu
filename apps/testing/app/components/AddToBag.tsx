"use client";

import { useState } from "react";
import { useCart } from "@/app/components/cart";
import { formatPrice, type Product } from "@/app/lib/catalog";

const SIZES = ["XS", "S", "M", "L", "XL"];

export function AddToBag({ product }: { product: Product }) {
  const { add, setOpen } = useCart();
  const [added, setAdded] = useState(false);
  const [size, setSize] = useState<string>("M");

  function onAdd() {
    add({ slug: product.slug, name: product.name, price: product.price, colorway: product.colorway, size });
    setAdded(true);
    setOpen(true);
  }

  return (
    <div className="addbag">
      <div className="size-row">
        <span className="eyebrow">Size</span>
        <div className="size-options" role="radiogroup" aria-label="Size">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={size === s}
              className={"size-chip" + (size === s ? " is-selected" : "")}
              onClick={() => setSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <button type="button" id="pdp-add" className="btn btn-primary btn-block" onClick={onAdd}>
        {added ? "Added — view bag" : `Add to bag · ${formatPrice(product.price)}`}
      </button>
      <p className="addbag-note">Complimentary shipping & returns. Ships within 2–3 business days.</p>
    </div>
  );
}
