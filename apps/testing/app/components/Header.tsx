"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/app/components/cart";
import { CATEGORIES, formatPrice } from "@/app/lib/catalog";

const MENU = [
  {
    heading: "New In",
    links: [
      { label: "Just Arrived", href: "/shop" },
      { label: "Autumn / Winter 2026", href: "/shop" },
      { label: "The Edit", href: "/shop" },
    ],
  },
  {
    heading: "Ready-to-Wear",
    links: CATEGORIES.map((c) => ({ label: c.name, href: "/shop" })),
  },
  {
    heading: "The House",
    links: [
      { label: "Our Story", href: "/about" },
      { label: "The Atelier", href: "/about" },
      { label: "Sustainability", href: "/about" },
    ],
  },
];

function IconBag() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8Z" strokeLinejoin="round" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" strokeLinecap="round" />
    </svg>
  );
}
function IconAccount() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
    </svg>
  );
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { count, lines, subtotal, open, setOpen, remove } = useCart();

  return (
    <header className="site-header">
      <div className="announce">Complimentary shipping &amp; returns on every order — worldwide</div>

      <div className="nav">
        <div className="nav-left">
          <button
            type="button"
            id="menu-button"
            className="menu-trigger"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="menu-bars" aria-hidden="true">
              <i />
              <i />
            </span>
            Menu
          </button>
          <nav className="nav-inline" aria-label="Primary">
            <Link href="/shop">New In</Link>
            <Link href="/shop">Ready-to-Wear</Link>
            <Link href="/about">The House</Link>
          </nav>
        </div>

        <Link href="/" className="wordmark" aria-label="Fashion — home">
          FASHION
        </Link>

        <div className="nav-right">
          <button type="button" className="icon-btn" aria-label="Search">
            <IconSearch />
          </button>
          <Link href="/about" className="icon-btn" aria-label="Account">
            <IconAccount />
          </Link>
          <button type="button" id="cart-button" className="icon-btn bag-btn" aria-label="Bag" onClick={() => setOpen(true)}>
            <IconBag />
            <span className="bag-count" data-count={count}>
              {count}
            </span>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div id="menu-panel" className="mega">
          <div className="mega-inner">
            {MENU.map((col) => (
              <div className="mega-col" key={col.heading}>
                <p className="eyebrow">{col.heading}</p>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href}>{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="mega-feature">
              <p className="eyebrow">Featured</p>
              <p className="mega-feature-title">The Autumn Coat</p>
              <a href="/products/the-camel-coat" className="link-underline">
                Discover &rarr;
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <div className={"drawer-scrim" + (open ? " is-open" : "")} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside id="cart-drawer" className={"cart-drawer" + (open ? " is-open" : "")} aria-label="Shopping bag" aria-hidden={!open}>
        <div className="drawer-head">
          <p className="eyebrow">Your Bag ({count})</p>
          <button type="button" className="drawer-close" aria-label="Close bag" onClick={() => setOpen(false)}>
            &times;
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="drawer-empty">
            <p>Your bag is empty.</p>
            <Link href="/shop" className="link-underline" onClick={() => setOpen(false)}>
              Explore the collection
            </Link>
          </div>
        ) : (
          <>
            <ul className="drawer-lines">
              {lines.map((l) => (
                <li className="drawer-line" key={`${l.slug}-${l.size ?? ""}`}>
                  <div className="drawer-line-media" aria-hidden="true" />
                  <div className="drawer-line-info">
                    <p className="drawer-line-name">{l.name}</p>
                    <p className="drawer-line-meta">
                      {l.colorway}
                      {l.size ? ` · Size ${l.size}` : ""} · Qty {l.qty}
                    </p>
                    <button type="button" className="drawer-line-remove" onClick={() => remove(l.slug, l.size)}>
                      Remove
                    </button>
                  </div>
                  <p className="drawer-line-price">{formatPrice(l.price * l.qty)}</p>
                </li>
              ))}
            </ul>
            <div className="drawer-foot">
              <div className="drawer-subtotal">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <p className="drawer-tax">Shipping &amp; duties calculated at checkout.</p>
              <button type="button" className="btn btn-primary btn-block">
                Checkout
              </button>
            </div>
          </>
        )}
      </aside>
    </header>
  );
}
