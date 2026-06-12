import { useEffect, useState } from "react";
import type { SceneProps } from "../types";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789*^><?#.@&%!+=/".split("");

type Shade = "bold" | "mid" | "dim" | "hidden";
// Weighting controls how often each state appears (more bold, some grays, a few absent).
const SHADES: Shade[] = ["bold", "bold", "bold", "mid", "mid", "dim", "dim", "dim", "hidden"];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;

interface Cell {
  ch: string;
  shade: Shade;
}

/** A small box counter, like the specimen sheet's "00" marker. */
function Counter({ size }: { size: number }): React.ReactElement {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v + 1) % 100), 700);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      style={{
        fontSize: Math.round(size * 0.7),
        fontWeight: 500,
        border: "1.5px solid currentColor",
        borderRadius: 5,
        padding: "3px 8px",
        letterSpacing: "0.06em",
        opacity: 0.85,
      }}
    >
      {String(n).padStart(2, "0")}
    </span>
  );
}

/**
 * A type specimen: a grid of glyphs that randomly change character and flicker between a bold
 * color, a dim color, and absent — a pleasing way to show off a typeface. Uses the served font
 * via `files.<name>` and is driven by its own timers (capture it realtime).
 */
export function Specimen({
  width,
  height,
  background,
  files,
  options,
}: SceneProps): React.ReactElement {
  const fontUrl = files.oracle ?? Object.values(files)[0] ?? "";
  const cols = typeof options.columns === "number" ? options.columns : 9;
  const rows = typeof options.rows === "number" ? options.rows : 3;
  const weight = typeof options.weight === "number" ? options.weight : 800;
  const label = typeof options.label === "string" ? options.label : "";
  const color = {
    bold: typeof options.bold === "string" ? options.bold : "#16181d",
    mid: typeof options.mid === "string" ? options.mid : "#a7adb6",
    dim: typeof options.dim === "string" ? options.dim : "#d3d7de",
    hidden: "transparent",
  };

  const barH = Math.round(height * 0.07);
  const gridH = height - barH;
  const cellH = gridH / rows;
  const cellW = width / cols;
  // Size glyphs large enough to nearly touch: cap-heights fill the row and the widest glyphs
  // sit edge-to-edge (cells use overflow:visible so they interlock, never clip).
  const fontSize = Math.round(Math.min(cellH * 1.18, cellW * 1.34));
  const count = cols * rows;

  const [cells, setCells] = useState<Cell[]>(() =>
    Array.from({ length: count }, () => ({ ch: pick(CHARSET), shade: pick(SHADES) })),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setCells((prev) => {
        const next = prev.slice();
        const changes = Math.max(1, Math.round(count * 0.06));
        for (let i = 0; i < changes; i++) {
          const idx = Math.floor(Math.random() * count);
          const cur = next[idx];
          next[idx] = {
            ch: Math.random() < 0.7 ? pick(CHARSET) : (cur?.ch ?? pick(CHARSET)),
            shade: pick(SHADES),
          };
        }
        return next;
      });
    }, 120);
    return () => clearInterval(id);
  }, [count]);

  return (
    <>
      <style>{`@font-face{font-family:'Specimen';src:url(${fontUrl}) format('woff2');font-weight:50 1000;font-style:normal;font-display:block;}`}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background,
          fontFamily: "'Specimen', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: gridH,
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
        >
          {cells.map((c, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "visible",
                lineHeight: 1,
              }}
            >
              <span style={{ fontSize, fontWeight: weight, color: color[c.shade], lineHeight: 1 }}>
                {c.ch}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: barH,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${Math.round(width * 0.018)}px`,
            color: color.bold,
          }}
        >
          <span style={{ fontSize: Math.round(barH * 0.42), fontWeight: 500, letterSpacing: "-0.01em" }}>
            {label}
          </span>
          <Counter size={Math.round(barH * 0.5)} />
        </div>
      </div>
    </>
  );
}
