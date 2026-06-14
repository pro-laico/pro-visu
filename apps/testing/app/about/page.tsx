export default function About() {
  return (
    <main>
      <section id="about-hero" style={{ background: "#0b0b0f" }}>
        <h1>About</h1>
        <p className="lead">A second route, used to exercise the multi-page tour.</p>
      </section>
      <section id="about-body" style={{ background: "#ffc107", color: "#0b0b0f" }}>
        <h2>Our story</h2>
        <p className="lead" style={{ color: "#0b0b0f" }}>
          This page exists so a `routes` tour has somewhere to go.
        </p>
      </section>
    </main>
  );
}
