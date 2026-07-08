import Link from "next/link";
import { StatTile } from "@/app/components/StatTile";
import { ProductSpecCard } from "@/app/components/ProductSpecCard";
import { BrandMark } from "@/app/components/BrandMark";
import { MiniGallery } from "@/app/components/MiniGallery";
import { getProduct } from "@/app/lib/catalog";
import { MEDIA } from "@/app/lib/media";

export const metadata = {
  title: "The Lookbook — FASHION",
  description: "Autumn / Winter 2026 — the house essentials, the cloth, the making.",
};

// Brand swatches for the palette panel (cognac is the rare warm accent).
const SWATCHES = [
  { name: "Ink", hex: "#1a1714", light: false },
  { name: "Paper", hex: "#f6f3ed", light: true },
  { name: "Camel", hex: "#b49a77", light: true },
  { name: "Loden", hex: "#5c5e4c", light: false },
  { name: "Cognac", hex: "#8a5a3c", light: false },
];

export default function Lookbook() {
  const coat = getProduct("the-camel-coat");
  const tote = getProduct("leather-tote");
  const crew = getProduct("cashmere-crewneck");
  const slip = getProduct("silk-slip-dress");

  return (
    <main>
      <section className="page-head">
        <p className="eyebrow">Autumn / Winter 2026</p>
        <h1 className="page-title">The Lookbook</h1>
        <p className="page-sub">A study in restraint — the house essentials, the cloth, the making.</p>
      </section>

      {/* An editorial brand board: imagery, type, proof-points, and tokenized product cards.
          Each panel carries a stable id so pro-visu.config.ts can focus-capture it as a 3:4 tile. */}
      <section className="lb-grid section-flush" aria-label="Lookbook">
        <div className="lb-panel lb-type" id="lb-wordmark">
          <span className="lb-wordmark">FASHION</span>
          <span className="lb-kicker">Maison · since 1994</span>
        </div>

        <div className="lb-panel lb-image" id="lb-editorial">
          {MEDIA.editorial ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={MEDIA.editorial} alt="The Autumn campaign" />
          ) : null}
        </div>

        <div className="lb-panel lb-stat" id="lb-stat-years">
          <StatTile value={30} unit="Years" label="The House" caption="Considered since 1994" animate />
        </div>

        <div className="lb-panel" id="lb-spec-coat">{coat ? <ProductSpecCard product={coat} /> : null}</div>

        <div className="lb-panel lb-type" id="lb-manifesto">
          <p className="lb-display">Made in measured quantities.</p>
        </div>

        <div className="lb-panel lb-mark" id="lb-mark">
          <BrandMark />
        </div>

        <div className="lb-panel lb-stat" id="lb-ships">
          <StatTile value="2–3" unit="Days" label="Shipping" caption="Complimentary, worldwide" />
        </div>

        <div className="lb-panel lb-swatch" id="lb-swatch">
          {SWATCHES.map((s) => (
            <div
              className="lb-swatch-band"
              key={s.name}
              style={{ background: s.hex, color: s.light ? "var(--ink)" : "var(--paper)" }}
            >
              <span>{s.name}</span>
            </div>
          ))}
        </div>

        <div className="lb-panel lb-type lb-quote" id="lb-quote">
          <p className="lb-display lb-display-sm">“We make a little, and we make it well.”</p>
          <span className="lb-kicker">Hélène Fashion, Founder</span>
        </div>

        <div className="lb-panel" id="lb-spec-tote">{tote ? <ProductSpecCard product={tote} /> : null}</div>

        <div className="lb-panel lb-image" id="lb-atelier">
          {MEDIA.aboutAtelier ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={MEDIA.aboutAtelier} alt="The atelier" />
          ) : null}
        </div>

        <div className="lb-panel lb-stat" id="lb-runs">
          <StatTile value="1 of 200" label="Measured runs" caption="Rarely discounted, never destroyed" />
        </div>

        <div className="lb-panel lb-image" id="lb-gallery">
          {slip?.image ? <MiniGallery src={slip.image} alt={slip.name} /> : null}
        </div>

        <div className="lb-panel lb-stat" id="lb-stat-pct">
          <StatTile value={100} unit="%" label="The Cloth" caption={"Traceable wool & cashmere"} animate />
        </div>

        <div className="lb-panel" id="lb-spec-crew">{crew ? <ProductSpecCard product={crew} /> : null}</div>

        <div className="lb-panel lb-type" id="lb-care">
          <p className="lb-display lb-display-sm">Lifetime care &amp; repairs.</p>
          <span className="lb-kicker">Re-tailored · re-knit · re-soled</span>
        </div>
      </section>

      <section className="lb-cta">
        <Link href="/shop" className="btn btn-outline">
          Shop the collection
        </Link>
      </section>
    </main>
  );
}
