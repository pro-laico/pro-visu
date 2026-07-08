import { notFound } from "next/navigation";
import { AddToBag } from "@/app/components/AddToBag";
import { ProductCard } from "@/app/components/ProductCard";
import { Placeholder } from "@/app/components/Placeholder";
import { MiniGallery } from "@/app/components/MiniGallery";
import { getProduct, PRODUCTS, relatedProducts } from "@/app/lib/catalog";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProduct(slug);
  return {
    title: product ? `${product.name} — FASHION` : "FASHION",
    description: product?.description,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const related = relatedProducts(product.slug);

  return (
    <main>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a> <span>/</span> <a href="/shop">Collection</a> <span>/</span>{" "}
        <span aria-current="page">{product.name}</span>
      </nav>

      <section id="product" className="pdp">
        <div className="pdp-gallery">
          {product.image ? (
            <>
              <MiniGallery src={product.image} alt={product.name} ratio="4 / 5" />
              <div className="pdp-gallery-thumbs">
                {["50% 18%", "50% 50%", "50% 82%"].map((pos) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={pos} className="pdp-thumb" src={product.image as string} alt="" style={{ objectPosition: pos }} />
                ))}
              </div>
            </>
          ) : (
            <>
              <Placeholder tone={product.tone} ratio="4 / 5" />
              <div className="pdp-gallery-thumbs">
                <Placeholder tone={product.tone} ratio="1 / 1" />
                <Placeholder tone="bone" ratio="1 / 1" />
                <Placeholder tone={product.tone} ratio="1 / 1" />
              </div>
            </>
          )}
        </div>

        <div className="pdp-info">
          <p className="eyebrow">{product.category}</p>
          <h1 className="pdp-title">{product.name}</h1>
          <p className="pdp-colorway">{product.colorway}</p>
          <p className="pdp-desc">{product.description}</p>

          <AddToBag product={product} />

          <div className="pdp-details">
            <p className="eyebrow">Details</p>
            <ul>
              {product.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="related" className="section">
        <div className="section-head section-head-center">
          <p className="eyebrow">You may also like</p>
          <h2 className="section-title">Complete the look</h2>
        </div>
        <div className="grid grid-4">
          {related.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>
    </main>
  );
}
