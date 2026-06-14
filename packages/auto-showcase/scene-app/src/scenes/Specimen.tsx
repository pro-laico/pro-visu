import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { SceneProps } from "../types";
import {
  buildEvents,
  buildInitialCells,
  buildSpec,
  classify,
  createCursor,
  mulberry32,
  pulseNameAt,
  DEFAULT_WEIGHTS,
  type Cell,
  type Pulse,
  type Token,
} from "./specimen-timeline";

/**
 * The specimen is one big wrapping string of `characters` glyphs, each its own independently
 * animated cell (one glyph per cell — no grouping). Each cell is assigned a width class (thin /
 * regular / wide, measured from the actual font) and only ever changes to other glyphs of that
 * class — so the line lengths stay stable as glyphs change. Because every glyph is its own cell,
 * pulses act per-character: a color sweep can wash every glyph evenly, one at a time.
 *
 * The animation is a pure function of time: a seeded, deterministic event schedule (see
 * specimen-timeline.ts) drives cell state through `window.__sceneSeek(t)`. The capture runtime
 * frame-steps it deterministically (`capture: "frames"`) or plays it on a rAF wall clock.
 */
const DEFAULT_LEADING = 0.78; // line-height: minimal leading so the cap-height lines sit close together

// Fallback used only if the host doesn't pass `pulses` (the generator always does). These describe
// the *outward* half; with mirroring on (default) the clip plays this out and back (~2x as long).
const DEFAULT_PULSES: Pulse[] = [
  { name: "hold", duration: 0.8 },
  { name: "letters", duration: 0.8, chars: 3 },
  { name: "settle", duration: 1.5 },
  { name: "colors", duration: 1.2, colors: 3 },
  { name: "rest", duration: 1.2 },
  { name: "finale", duration: 1.2, chars: 4, colors: 3 },
  { name: "outro", duration: 3.3 },
];

/** Greedy break-all wrap, matching the browser, using measured per-glyph advances (in em). */
function wrapLineCount(text: string, adv: Record<string, number>, maxEm: number): number {
  let lines = 1;
  let w = 0;
  for (const ch of text) {
    const a = adv[ch] ?? 0.6;
    if (w + a > maxEm && w > 0) {
      lines++;
      w = a;
    } else {
      w += a;
    }
  }
  return lines;
}

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

/**
 * A type specimen: one big wrapping string of `characters` width-classed glyph cells whose glyphs
 * and colors change over a config-composed sequence of "pulses" (mirrored into a seamless loop by
 * default). Cells set their color statefully via UnoCSS attributify tokens
 * (`text="foreground|muted|accent"`) → `--sp-*` CSS variables the wrapper sets from config. Served
 * via `files.<name>`; captured with the deterministic frame-stepper.
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
  const label = typeof options.label === "string" ? options.label : "";
  const demo = options.demo === true;
  const characters = typeof options.characters === "number" ? Math.max(1, options.characters) : 23;
  const blacklist = typeof options.blacklist === "string" ? options.blacklist : "";
  const fontSizeOpt = typeof options.fontSize === "number" ? options.fontSize : undefined;
  const leading = typeof options.leading === "number" ? options.leading : DEFAULT_LEADING;
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
  const pulsesKey = `${JSON.stringify(pulses)}|${mirror}|${charIntensity}|${colorIntensity}|${JSON.stringify(weights)}|${seed}`;
  const colors = (options.colors ?? {}) as Record<string, string>;
  const foreground = colors.foreground ?? "#16181d";
  const muted = colors.muted ?? "#a7adb6";
  const accent = colors.accent ?? background; // accent falls back to the backdrop (blends in)
  const labelColor = colors.label ?? foreground; // font-name label falls back to foreground

  // The per-character width classes. Char lists per class are measured after the font loads.
  const specKey = `${characters}|${blacklist}|${characterPool ?? ""}`;
  const spec = useMemo(() => buildSpec(characters, blacklist, characterPool), [specKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Frame: a tight 5px top/left/right margin (near full-bleed text), and a roomy bottom (bar +
  // gap) so the font name never feels crowded.
  const sideInset = 5;
  const topInset = 5;
  const barH = Math.round(height * 0.09);
  const bottomGap = Math.round(height * 0.04);
  const typeArea = height - topInset - barH - bottomGap; // vertical space for the text block
  const lineWidth = width - sideInset * 2;

  const [cells, setCells] = useState<Cell[]>(() =>
    spec.cls.map(() => ({ text: "", token: "foreground" as Token })),
  );
  const [fit, setFit] = useState<number | null>(null);
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

  // Once the font is loaded: measure it, classify the pool by width, seed the opening cells and the
  // deterministic event schedule, size the type (unless `fontSize` is set), and publish the
  // timeline seek hook. Gating __sceneReady on all of this means capture only starts when seeking
  // is possible and the opening state has painted.
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
      const classes = classify(spec.pool, adv);

      // One seeded stream feeds the initial cells AND the schedule, in a fixed order — every
      // context that runs this computes the byte-identical animation.
      const rng = mulberry32(seed);
      const initial = buildInitialCells(spec.cls, classes, spec.pool, rng);
      setCells(initial.map((c) => ({ ...c })));

      if (fontSizeOpt == null) {
        const listFor = (c: (typeof spec.cls)[number]): string[] =>
          classes[c].length ? classes[c] : [...spec.pool];
        const worst = spec.cls
          .map((c) => {
            const list = listFor(c);
            return list.reduce((w, ch) => ((adv[ch] ?? 0) > (adv[w] ?? -1) ? ch : w), list[0] ?? "");
          })
          .join("");
        const fits = (size: number): boolean =>
          wrapLineCount(worst, adv, (lineWidth / size) * 0.99) * leading * size <= typeArea;
        let lo = 16;
        let hi = Math.floor(typeArea / leading);
        while (hi - lo > 1) {
          const m = (lo + hi) >> 1;
          if (fits(m)) lo = m;
          else hi = m;
        }
        setFit(lo);
      }

      const events = buildEvents(
        pulses,
        mirror,
        spec.cls,
        classes,
        initial,
        charIntensity,
        colorIntensity,
        weights,
        rng,
      );
      const cursor = createCursor(initial, events);

      // The timeline hook: the runtime frame-steps this (seek) or drives it from a rAF clock
      // (play). flushSync commits the DOM before the runtime's trailing rAF + screenshot, so every
      // captured frame shows exactly the state for its time.
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
  }, [specKey, pulsesKey, weight, lineWidth, typeArea, fontSizeOpt, leading, seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const fontSize = fontSizeOpt ?? fit ?? Math.round(typeArea / (3 * leading));

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
            top: topInset,
            left: sideInset,
            right: sideInset,
            height: typeArea,
            display: "flex",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: "100%",
              fontSize,
              fontWeight: weight,
              lineHeight: leading,
              color: "var(--sp-foreground)",
              wordBreak: "break-all",
            }}
          >
            {cells.map((c, i) => (
              <span key={i} text={c.token}>
                {c.text}
              </span>
            ))}
          </div>
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
            color: "var(--sp-foreground)",
          }}
        >
          <span
            style={{
              fontSize: Math.round(barH * 0.42),
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: "var(--sp-label)",
            }}
          >
            {label}
          </span>
          {demo && (
            <PulseLabel size={barH} pulses={pulses} clip={durationSeconds} mirror={mirror} t={clock} />
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
