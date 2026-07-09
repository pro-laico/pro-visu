import { Placeholder } from "@/app/components/Placeholder";
import { formatPrice, type Product } from "@/app/lib/catalog";

export function ProductSpecCard({ product }: { product: Product }) {
  return (
    <article className="spec-card">
      {product.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="spec-card-img" src={product.image} alt={product.name} />
      ) : (
        <Placeholder tone={product.tone} ratio="3 / 4" className="spec-card-img" />
      )}
      <div className="spec-bar spec-bar-top">
        <span>{product.category}</span>
        <span>{formatPrice(product.price)}</span>
      </div>
      <div className="spec-bar spec-bar-bottom">
        <span className="spec-card-name">{product.name}</span>
        <span className="spec-card-cloth">{product.details[0]}</span>
      </div>
    </article>
  );
}
