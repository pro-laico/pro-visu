import Link from "next/link";

const COLUMNS = [
  {
    heading: "Shop",
    links: ["New In", "Outerwear", "Knitwear", "Tailoring", "Accessories"],
  },
  {
    heading: "Client Care",
    links: ["Contact", "Shipping & Returns", "Size Guide", "Garment Care", "FAQ"],
  },
  {
    heading: "The House",
    links: ["Our Story", "The Atelier", "Sustainability", "Stores", "Careers"],
  },
];

export function Footer() {
  return (
    <footer className="site-footer" id="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <p className="wordmark wordmark-lg">VESPER</p>
          <p className="footer-tag">Considered tailoring, quietly made. Paris &amp; Porto, since 1994.</p>
        </div>

        <div className="footer-signup">
          <p className="eyebrow">The Newsletter</p>
          <p className="footer-signup-copy">New collections, atelier notes and private previews.</p>
          <div className="signup-row">
            <input type="email" placeholder="Email address" aria-label="Email address" />
            <button type="button" className="btn btn-outline">
              Sign up
            </button>
          </div>
        </div>
      </div>

      <div className="footer-cols">
        {COLUMNS.map((col) => (
          <nav className="footer-col" key={col.heading} aria-label={col.heading}>
            <p className="eyebrow">{col.heading}</p>
            <ul>
              {col.links.map((l) => (
                <li key={l}>
                  <Link href="/shop">{l}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="footer-bottom">
        <p>© 2026 Maison Vesper. All rights reserved.</p>
        <div className="footer-social">
          <Link href="/">Instagram</Link>
          <Link href="/">Pinterest</Link>
          <Link href="/">Journal</Link>
        </div>
      </div>
    </footer>
  );
}
