import Link from "next/link";
import { Placeholder } from "@/app/components/Placeholder";
import { MEDIA } from "@/app/lib/media";

export const metadata = {
  title: "The House — VESPER",
  description: "Maison Vesper: considered tailoring, quietly made in Europe since 1994.",
};

const PILLARS = [
  {
    heading: "The Cloth",
    body: "We buy from a handful of historic mills in Italy and Portugal — responsible wool, grade-A cashmere, sand-washed silk. Fewer suppliers, longer relationships, better cloth.",
  },
  {
    heading: "The Making",
    body: "Garments are cut and sewn in family-run ateliers we have worked with for decades. Half-canvas tailoring, French seams, hand-finished edges — the slow details you only notice over years.",
  },
  {
    heading: "The Quantity",
    body: "We produce in measured runs and rarely discount. What does not sell is carried forward, not destroyed. Nothing here is designed to be replaced next season.",
  },
];

export default function About() {
  return (
    <main>
      <section id="about-hero" className="about-hero">
        <div className="about-hero-media">
          <Placeholder tone="ink" ratio="16 / 9" src={MEDIA.aboutHero} alt="" />
        </div>
        <div className="about-hero-overlay">
          <p className="eyebrow eyebrow-light">The House</p>
          <h1 className="about-title">Maison Vesper</h1>
          <p className="about-lede">Considered tailoring, quietly made. Paris &amp; Porto, since 1994.</p>
        </div>
      </section>

      <section id="about-statement" className="about-statement">
        <p className="eyebrow">Our Story</p>
        <p className="statement-text">
          Vesper began in a single Paris atelier with a simple brief: make a small number of beautifully resolved
          clothes, and make them properly. Thirty years on, the brief has not changed.
        </p>
      </section>

      <section id="about-pillars" className="section">
        <div className="grid grid-3">
          {PILLARS.map((p) => (
            <article className="pillar" key={p.heading}>
              <h2 className="pillar-heading">{p.heading}</h2>
              <p className="pillar-body">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="about-atelier" className="editorial">
        <div className="editorial-media">
          <Placeholder tone="oat" ratio="4 / 5" src={MEDIA.aboutAtelier} alt="" />
        </div>
        <div className="editorial-copy">
          <p className="eyebrow">The Atelier</p>
          <h2 className="editorial-title">Made by hand, made to last</h2>
          <p className="editorial-text">
            Every Vesper piece is built to be repaired, not retired. Our lifetime care programme re-tailors, re-knits
            and re-soles the garments you already own — because the most sustainable coat is the one you keep.
          </p>
          <Link href="/shop" className="btn btn-outline">
            Shop the collection
          </Link>
        </div>
      </section>
    </main>
  );
}
