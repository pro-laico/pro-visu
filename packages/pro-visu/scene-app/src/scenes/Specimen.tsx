import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { SceneProps } from "../types";
import {
  buildEvents,
  buildSpec,
  packAndSeedLines,
  createCursor,
  maxLineDrift,
  mulberry32,
  pulseNameAt,
  DEFAULT_WEIGHTS,
  type Cell,
  type Pulse,
  type Token,
} from "./specimen-timeline";

/**
 * The specimen is a fixed number of LEFT-ALIGNED lines, each filled with width-classed glyph cells
 * to a target width derived from the font's real advances. The glyph size is derived from `lines`
 * (the rows fill the top 80% of the frame); the bottom 20% shows the background + the font name.
 * Glyphs and colors change over a config-composed sequence of "pulses" (mirrored into a seamless
 * loop by default). Glyph changes are width-compensated so each line's total width — and thus its
 * right edge — barely shifts (≤ `maxLineDrift`) as the wall animates.
 *
 * The animation is a pure function of time: a seeded, deterministic event schedule (see
 * specimen-timeline.ts) drives cell state through `window.__sceneSeek(t)`. The capture runtime
 * frame-steps it deterministically (`capture: "frames"`) or plays it on a rAF wall clock.
 */
const DEFAULT_LEADING = 0.78; // line-height: minimal leading so the cap-height lines sit close together
const DEFAULT_LINES = 3;
const DEFAULT_DRIFT = 0.05;
const MIN_PER_LINE = 3; // never let a huge font collapse a line to 1–2 glyphs
const TYPE_FRACTION = 0.8; // glyph wall fills the top 80%; bottom 20% = background + label

// Fallback used only if the host doesn't pass `pulses` (the generator always does). `chars`/`colors`
// are fractions of the wall. These describe the *outward* half; with mirroring on it plays out + back.
const DEFAULT_PULSES: Pulse[] = [
  { name: "hold", duration: 0.8 },
  { name: "letters", duration: 0.8, chars: 0.13 },
  { name: "settle", duration: 1.5 },
  { name: "colors", duration: 1.2, colors: 0.13 },
  { name: "rest", duration: 1.2 },
  { name: "finale", duration: 1.2, chars: 0.17, colors: 0.13 },
  { name: "outro", duration: 3.3 },
];

/** Demo overlay: the name of the pulse playing at clip-time `t` (pure — driven by the seek clock). */
function PulseLabel({
  size,
  pulses,
  clip,
  mirror,
  t,
}: {
  size: number;
  pulses: Pulse[];
  clip: number;
  mirror: boolean;
  t: number;
}): React.ReactElement {
  const name = pulseNameAt(pulses, t, mirror, clip);
  return (
    <span
      style={{
        fontSize: Math.round(size * 0.42),
        fontWeight: 500,
        letterSpacing: "-0.01em",
        opacity: 0.75,
      }}
    >
      {name ? `▸ ${name}` : ""}
    </span>
  );
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Absolute-position style for the name label within the bottom gap area. `anchor` is one of the nine
 * positions (vertical `top|middle|bottom` × horizontal `left|center|right`); `padding` insets it from
 * the gap edges (0 = flush to the rendered corner). Center axes use a 50% + translate so the label
 * stays centered regardless of its own size.
 */
function labelAnchorStyle(anchor: string, padding: number): React.CSSProperties {
  const [v, h] = anchor.split("-");
  const s: React.CSSProperties = { position: "absolute" };
  const tx: string[] = [];
  if (v === "top") s.top = padding;
  else if (v === "bottom") s.bottom = padding;
  else {
    s.top = "50%";
    tx.push("translateY(-50%)");
  }
  if (h === "left") {
    s.left = padding;
    s.textAlign = "left";
  } else if (h === "right") {
    s.right = padding;
    s.textAlign = "right";
  } else {
    s.left = "50%";
    s.textAlign = "center";
    tx.push("translateX(-50%)");
  }
  if (tx.length) s.transform = tx.join(" ");
  return s;
}

/**
 * A type specimen: `lines` left-aligned rows of glyph cells whose glyphs and colors change over a
 * config-composed sequence of "pulses" (mirrored into a seamless loop by default). Cells set their
 * color statefully via UnoCSS attributify tokens (`text="foreground|muted|accent"`) → `--sp-*` CSS
 * variables the wrapper sets from config. Served via `files.<name>`; captured with the deterministic
 * frame-stepper.
 */
export function Specimen({
  width,
  height,
  background,
  files,
  options,
  durationSeconds,
}: SceneProps): React.ReactElement {
  const fontUrl = files.oracle ?? Object.values(files)[0] ?? "";
  const weight = typeof options.weight === "number" ? options.weight : 800;
  // The name label: its text plus placement/styling within the bottom gap area. Older wire payloads
  // sent `label` as a bare string (the text) — tolerate that so cached scenes keep working.
  const labelOpt =
    typeof options.label === "string"
      ? { text: options.label }
      : ((options.label ?? {}) as {
          text?: string;
          anchor?: string;
          padding?: number;
          size?: number;
          weight?: number;
          color?: string;
        });
  const label = typeof labelOpt.text === "string" ? labelOpt.text : "";
  const labelAnchor = typeof labelOpt.anchor === "string" ? labelOpt.anchor : "bottom-left";
  const labelPadding = typeof labelOpt.padding === "number" ? labelOpt.padding : 32;
  const labelSize = typeof labelOpt.size === "number" ? labelOpt.size : 0.22;
  const labelWeight = typeof labelOpt.weight === "number" ? labelOpt.weight : 500;
  const demo = options.demo === true;
  const lines = typeof options.lines === "number" ? Math.max(1, Math.round(options.lines)) : DEFAULT_LINES;
  const blacklist = typeof options.blacklist === "string" ? options.blacklist : "";
  const leading = typeof options.leading === "number" ? options.leading : DEFAULT_LEADING;
  const tol = typeof options.maxLineDrift === "number" ? options.maxLineDrift : DEFAULT_DRIFT;
  const characterPool =
    typeof options.characterPool === "string" ? options.characterPool : undefined;
  // The schedule seed: same seed ⇒ identical animation in every browser context. The parallel
  // frame-stepper relies on this — each worker loads the page independently and must agree.
  const seed = typeof options.seed === "number" ? options.seed : 1;
  const pulses =
    Array.isArray(options.pulses) && options.pulses.length
      ? (options.pulses as Pulse[])
      : DEFAULT_PULSES;
  const mirror = options.mirror !== false; // seamless loop by default
  const charIntensity = typeof options.characterIntensity === "number" ? options.characterIntensity : 1;
  const colorIntensity = typeof options.colorIntensity === "number" ? options.colorIntensity : 1;
  // Relative likelihood of each token on a random (non-targeted) color change. Config-controlled.
  const cw = (options.colorWeights ?? {}) as Partial<Record<Token, number>>;
  const weights: Record<Token, number> = {
    foreground: typeof cw.foreground === "number" ? cw.foreground : DEFAULT_WEIGHTS.foreground,
    muted: typeof cw.muted === "number" ? cw.muted : DEFAULT_WEIGHTS.muted,
    accent: typeof cw.accent === "number" ? cw.accent : DEFAULT_WEIGHTS.accent,
  };
  const pulsesKey = `${JSON.stringify(pulses)}|${mirror}|${charIntensity}|${colorIntensity}|${JSON.stringify(weights)}|${seed}|${tol}`;
  const colors = (options.colors ?? {}) as Record<string, string>;
  const foreground = colors.foreground ?? "#16181d";
  const muted = colors.muted ?? "#a7adb6";
  const accent = colors.accent ?? background; // accent falls back to the backdrop (blends in)
  const labelColor = labelOpt.color ?? foreground; // font-name label falls back to foreground

  // The glyph pool (master minus blacklist), measured into widths after the font loads.
  const specKey = `${blacklist}|${characterPool ?? ""}`;
  const spec = useMemo(() => buildSpec(blacklist, characterPool), [specKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Geometry: the glyph wall fills the top 80% full-bleed; the bottom 20% is background + label.
  const typeArea = Math.round(height * TYPE_FRACTION);
  const barH = height - typeArea;
  const fontSize = clamp(Math.floor(typeArea / (lines * leading)), 8, typeArea);
  const lineH = fontSize * leading;
  const targetEm = width / fontSize; // per-line advance budget, in em

  const [cells, setCells] = useState<Cell[]>([]);
  const [lineLengths, setLineLengths] = useState<number[]>([]);
  const [clock, setClock] = useState(0); // current timeline position (drives the demo overlay)

  // Hold capture until the glyphs are actually on screen. The cells start empty and are only seeded
  // once the font loads, so without this the capture (which starts at fonts.ready) could grab a
  // blank first frame. We publish a promise the runtime awaits and resolve it after the seed has
  // painted (a double rAF guarantees a committed frame). Created once, synchronously at first
  // render, so the runtime sees it before its own ready check.
  const sceneReady = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!sceneReady.current) {
    let resolve: () => void = () => {};
    const promise = new Promise<void>((r) => (resolve = r));
    sceneReady.current = { promise, resolve };
    window.__sceneReady = promise;
  }
  const markPainted = (): void => {
    requestAnimationFrame(() => requestAnimationFrame(() => sceneReady.current?.resolve()));
  };

  // Once the font is loaded: measure it, pack the lines to width using real advances, seed the
  // opening cells and the deterministic (width-compensated) event schedule, and publish the timeline
  // seek hook. Gating __sceneReady on all of this means capture only starts when seeking is possible
  // and the opening state has painted.
  useEffect(() => {
    let cancelled = false;
    const setup = (): void => {
      if (cancelled) return;
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) {
        markPainted(); // never leave the capture runtime waiting on an unresolved ready gate
        return;
      }
      ctx.font = `${weight} 100px 'Specimen'`;
      const adv: Record<string, number> = {};
      for (const ch of spec.pool) adv[ch] = ctx.measureText(ch).width / 100;

      // One seeded stream feeds the packing AND the schedule, in a fixed order — every context that
      // runs this computes the byte-identical wall + animation.
      const rng = mulberry32(seed);
      const packed = packAndSeedLines({
        lines,
        targetEm,
        adv,
        pool: spec.pool,
        rng,
        minPerLine: MIN_PER_LINE,
      });
      setCells(packed.cells.map((c) => ({ ...c })));
      setLineLengths(packed.lineLengths);

      const events = buildEvents(
        pulses,
        mirror,
        packed.cells,
        adv,
        spec.pool,
        packed.lineLengths,
        packed.lineInitialEm,
        charIntensity,
        colorIntensity,
        weights,
        tol,
        rng,
      );
      const cursor = createCursor(packed.cells, events);

      // The ≤tol guarantee holds by construction unless the pool is too small to compensate — warn
      // (don't fail) in that degenerate case so a constrained config is visible.
      const drift = maxLineDrift(packed.cells, events, adv, packed.lineLengths);
      if (drift > tol + 1e-6) {
        console.warn(
          `[specimen] line width drifts up to ${(drift * 100).toFixed(1)}% (budget ${(tol * 100).toFixed(0)}%) — the character pool may be too small to stay stable.`,
        );
      }

      // The timeline hook: the runtime frame-steps this (seek) or drives it from a rAF clock (play).
      // flushSync commits the DOM before the runtime's trailing rAF + screenshot, so every captured
      // frame shows exactly the state for its time.
      window.__sceneSeek = (t: number) => {
        flushSync(() => {
          setCells(cursor.stateAt(t));
          setClock(t);
        });
      };

      // Hook published and glyphs seeded — let the runtime start capturing once this paints.
      markPainted();
    };
    void (document.fonts?.ready ?? Promise.resolve()).then(setup);
    return () => {
      cancelled = true;
      delete window.__sceneSeek;
    };
  }, [specKey, pulsesKey, weight, lines, leading, width, height, seed, tol]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cumulative start index of each line, for slicing the flat `cells` into rows.
  const offsets = useMemo(() => {
    const out: number[] = [];
    let a = 0;
    for (const len of lineLengths) {
      out.push(a);
      a += len;
    }
    return out;
  }, [lineLengths]);

  const rootStyle = {
    position: "absolute",
    inset: 0,
    background,
    fontFamily: "'Specimen', system-ui, sans-serif",
    "--sp-foreground": foreground,
    "--sp-muted": muted,
    "--sp-accent": accent,
    "--sp-label": labelColor,
  } as React.CSSProperties;

  return (
    <>
      <style>{`@font-face{font-family:'Specimen';src:url(${fontUrl}) format('woff2');font-weight:50 1000;font-style:normal;font-display:block;}`}</style>
      <div style={rootStyle}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: typeArea,
            overflow: "hidden",
          }}
        >
          {lineLengths.map((len, L) => (
            <div
              key={L}
              style={{
                display: "flex",
                justifyContent: "flex-start",
                whiteSpace: "nowrap",
                height: lineH,
                lineHeight: `${lineH}px`,
                fontSize,
                fontWeight: weight,
                color: "var(--sp-foreground)",
                fontKerning: "none",
                fontVariantLigatures: "none",
                letterSpacing: 0,
                overflow: "hidden",
              }}
            >
              {cells.slice(offsets[L] ?? 0, (offsets[L] ?? 0) + len).map((c, i) => (
                <span key={i} text={c.token}>
                  {c.text}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: typeArea,
            bottom: 0,
            height: barH,
            color: "var(--sp-foreground)",
          }}
        >
          <span
            style={{
              ...labelAnchorStyle(labelAnchor, labelPadding),
              fontSize: Math.round(barH * labelSize),
              fontWeight: labelWeight,
              letterSpacing: "-0.01em",
              color: "var(--sp-label)",
              whiteSpace: "nowrap",
              // Trim the line box to the cap height (top) and alphabetic baseline (bottom) so the
              // font's ascent/descent leading doesn't add phantom space — without this the label's
              // box extends a descender below the visible text, so `padding` reads larger at the
              // bottom than at the sides. With the trim, `padding` is uniform on all four edges.
              display: "inline-block",
              lineHeight: 1,
              ...({ textBoxTrim: "trim-both", textBoxEdge: "cap alphabetic" } as React.CSSProperties),
            }}
          >
            {label}
          </span>
          {/* Demo overlay stays pinned bottom-right of the gap so it doesn't move with the label. */}
          {demo && (
            <span
              style={{
                position: "absolute",
                right: Math.round(width * 0.018),
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              <PulseLabel
                size={Math.round(barH * 0.52)}
                pulses={pulses}
                clip={durationSeconds}
                mirror={mirror}
                t={clock}
              />
            </span>
          )}
        </div>
        {/* Keep UnoCSS aware of the attributify color tokens (these are never rendered). */}
        {false && (
          <>
            <i text="foreground" />
            <i text="muted" />
            <i text="accent" />
          </>
        )}
      </div>
    </>
  );
}
