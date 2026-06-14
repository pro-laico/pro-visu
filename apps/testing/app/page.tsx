import { FeatureCard, Menu } from "./interactive";

const COLORS = [
  { name: "Ink", hex: "#0b0b0f" },
  { name: "Blue", hex: "#7c9cff" },
  { name: "Pink", hex: "#e91e63" },
  { name: "Amber", hex: "#ffc107" },
  { name: "Cyan", hex: "#00bcd4" },
];

export default function Home() {
  return (
    <main>
      <section id="hero" style={{ background: "var(--bg)" }}>
        <Menu />
        <h1>auto-showcase</h1>
        <p className="lead">A sample target site used to generate and validate showcase assets.</p>
      </section>

      <section id="features" style={{ background: "#7c9cff", color: "#0b0b0f" }}>
        <h2>Features</h2>
        <p className="lead" style={{ color: "#0b0b0f" }}>
          Scroll reels, screenshots, device frames, scenes, palettes, interaction and more.
        </p>
        <FeatureCard />
      </section>

      <section id="showcase" style={{ background: "#0b0b0f" }}>
        <h2>Brand colours</h2>
        <div className="swatches">
          {COLORS.map((c) => (
            <div key={c.hex} className="swatch" style={{ background: c.hex, color: c.hex === "#0b0b0f" ? "#fff" : "#0b0b0f" }}>
              {c.hex}
            </div>
          ))}
        </div>
      </section>

      <section id="type" style={{ background: "#e91e63" }}>
        <h2 style={{ fontSize: "clamp(48px,10vw,140px)" }}>Aa Bb Cc</h2>
        <p className="lead" style={{ color: "#ffe" }}>The quick brown fox jumps over the lazy dog.</p>
      </section>

      <section id="contact" style={{ background: "#00bcd4", color: "#0b0b0f" }}>
        <h2>Get in touch</h2>
        <p className="lead" style={{ color: "#0b0b0f" }}>hello@example.com</p>
      </section>
    </main>
  );
}
