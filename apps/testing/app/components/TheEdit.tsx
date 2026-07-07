"use client";

import { useState } from "react";
import { formatPrice, getProduct } from "@/app/lib/catalog";

// The Edit — a tap-to-browse module: one large visual with the active piece's name and price
// overlaid, and a rail of product thumbnails below. Tapping a thumbnail crossfades the stage
// to that piece. The thumbnails sit on a single row so a scripted capture never scroll-jumps
// between taps. Stable hooks: #edit (section), #edit-stage (visual), .edit-thumb (the options).

const EDIT_SLUGS = ["the-camel-coat", "silk-slip-dress", "double-breasted-blazer", "leather-tote"];

export function TheEdit() {
  const picks = EDIT_SLUGS.map((slug) => getProduct(slug)).filter((p) => p !== undefined);
  const [active, setActive] = useState(0);

  return (
    <section id="edit" className="section edit">
      <div className="section-head section-head-center">
        <p className="eyebrow">The Edit</p>
        <h2 className="section-title">One look, four pieces</h2>
      </div>

      <div className="edit-module">
        <div id="edit-stage" className="edit-stage">
          {/* Each layer carries its own caption so photo + label crossfade together. */}
          {picks.map((p, i) => (
            <figure key={p.slug} className={"edit-visual" + (i === active ? " is-active" : "")} aria-hidden={i !== active}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt={i === active ? p.name : ""} />
              <figcaption className="edit-caption">
                <p className="edit-caption-name">{p.name}</p>
                <p className="edit-caption-meta">
                  {p.colorway} &middot; {formatPrice(p.price)}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="edit-thumbs" role="radiogroup" aria-label="Pieces in this edit">
          {picks.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              role="radio"
              aria-checked={i === active}
              aria-label={p.name}
              className={"edit-thumb" + (i === active ? " is-active" : "")}
              onClick={() => setActive(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt="" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
