"use client";

import { useState } from "react";

export function Menu() {
  const [open, setOpen] = useState(false);
  return (
    <nav>
      <button id="menu-button" onClick={() => setOpen((o) => !o)}>
        Menu
      </button>
      {open && (
        <div id="menu-panel">
          <a href="#features">Features</a>
          <a href="#showcase">Showcase</a>
          <a href="/about">About</a>
        </div>
      )}
    </nav>
  );
}

export function FeatureCard() {
  const [open, setOpen] = useState(false);
  return (
    <div id="feature-card" className="card">
      <h3>Deterministic capture</h3>
      <button onClick={() => setOpen((o) => !o)}>Details</button>
      {open && <p id="feature-more">Frame-stepped rendering makes every reel byte-identical run to run.</p>}
    </div>
  );
}
