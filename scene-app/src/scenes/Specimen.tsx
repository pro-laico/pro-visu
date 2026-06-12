import { useEffect, useMemo, useRef, useState } from "react";
import type { SceneProps } from "../types";

/**
 * The specimen is one big wrapping string of `characters` glyphs, each its own independently
 * animated cell (one glyph per cell — no grouping). Each cell is assigned a width class (thin /
 * regular / wide, measured from the actual font) and only ever changes to other glyphs of that
 * class — so the line lengths stay stable as glyphs change. Because every glyph is its own cell,
 * pulses act per-character: a color sweep can wash every glyph evenly, one at a time, instead of
 * recoloring clumps of 2–3. Glyphs are drawn from a master pool minus a config blacklist.
 */
const MASTER_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$%&@#*+=";

type Cls = "thin" | "regular" | "wide";
type Classes = Record<Cls, string[]>;
// Rotated across cells so the opening string is a balanced mix of widths.
const CLASS_ROTATION: Cls[] = ["regular", "wide", "thin", "regular", "thin", "wide"];

type Token = "foreground" | "muted" | "accent";
const TOKENS: Token[] = ["foreground", "muted", "accent"];
// Default relative likelihood of each token on a random color change (accent rarer — a pop, not the
// norm). Overridden per-render by the `colorWeights` config.
const DEFAULT_WEIGHTS: Record<Token, number> = { foreground: 2, muted: 2, accent: 1 };

interface Cell {
  text: string;
  token: Token;
}

const LEADING = 0.78; // line-height: minimal leading so the cap-height lines sit close together

/** Effective glyph spec from config: the pool (minus blacklist) and the per-character width class
 *  (one class per glyph cell). Char lists per class are measured later (they depend on the font). */
function buildSpec(characters: number, blacklist: string): { cls: Cls[]; pool: string } {
  const black = new Set(blacklist.toUpperCase().split(""));
  let pool = [...MASTER_POOL].filter((c) => !black.has(c)).join("");
  if (!pool) pool = MASTER_POOL; // never let a blacklist empty the pool
  const cls = Array.from(
    { length: Math.max(1, characters) },
    (_, i) => CLASS_ROTATION[i % CLASS_ROTATION.length] ?? "regular",
  );
  return { cls, pool };
}

/**
 * Pick a color token by weight, optionally excluding the current one (so a random recolor actually
 * changes). Tokens with weight 0 are never chosen at random. Falls back to any different token if
 * weighting would otherwise yield nothing.
 */
function weightedColor(weights: Record<Token, number>, exclude?: Token): Token {
  let pool = TOKENS.filter((t) => t !== exclude && (weights[t] ?? 0) > 0);
  if (!pool.length) pool = TOKENS.filter((t) => t !== exclude);
  if (!pool.length) return exclude ?? "foreground";
  const total = pool.reduce((s, t) => s + (weights[t] ?? 1), 0);
  let r = Math.random() * total;
  for (const t of pool) {
    r -= weights[t] ?? 1;
    if (r <= 0) return t;
  }
  return pool[pool.length - 1] as Token;
}

/**
 * A picker that yields cell indices with even coverage: a shuffled permutation of all cells,
 * reshuffled when exhausted — so every cell is touched once before any repeats. This is what makes
 * a sweep land on every glyph evenly instead of randomly hitting some twice and skipping others.
 */
function evenCellPicker(count: number): () => number {
  let bag: number[] = [];
  return () => {
    if (!bag.length) {
      bag = Array.from({ length: count }, (_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j] as number, bag[i] as number];
      }
    }
    return bag.pop() as number;
  };
}

/** Partition the pool into thin / regular / wide thirds by measured advance. */
function classify(pool: string, adv: Record<string, number>): Classes {
  const chars = [...pool].sort((a, b) => (adv[a] ?? 0) - (adv[b] ?? 0));
  const n = chars.length;
  const t = Math.max(1, Math.floor(n / 3));
  return {
    thin: chars.slice(0, t),
    regular: chars.slice(t, Math.max(t, n - t)),
    wide: chars.slice(n - t),
  };
}

const randFromClass = (list: string[], len: number): string => {
  let s = "";
  for (let i = 0; i < len; i++) s += list[Math.floor(Math.random() * list.length)] ?? "";
  return s;
};

/** A random `len`-char string from a class, different from `not` when the class allows it. */
function differentFromClass(list: string[], len: number, not: string): string {
  for (let i = 0; i < 8; i++) {
    const s = randFromClass(list, len);
    if (s !== not) return s;
  }
  return randFromClass(list, len);
}

/** One beat of the animation: glyph/color changes spread across its duration (0/0 = a hold). */
interface Pulse {
  name?: string;
  duration: number;
  chars?: number;
  colors?: number;
  /** When set, every color change in the beat targets this exact token (a sweep) — else weighted. */
  color?: Token;
  pacing?: "even" | "linear" | "ease-in" | "ease-out" | "ease-in-out" | "random";
}

/** Easing curve mapping an even fraction (0..1) to a time fraction within a beat, like CSS easing. */
function ease(u: number, pacing: Pulse["pacing"]): number {
  switch (pacing) {
    case "ease-in":
      return u * u; // front-loaded
    case "ease-out":
      return 1 - (1 - u) * (1 - u); // back-loaded
    case "ease-in-out":
      return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u); // bunched at both ends
    default:
      return u; // "even" / "linear"
  }
}

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

/** A scheduled change that sets one cell's glyph or color to an exact value at an absolute time. */
interface SetEvent {
  t: number;
  slot: number; // cell index
  kind: "char" | "color";
  value: string;
}

/**
 * Build the full change schedule, one pulse at a time. Within a pulse the N glyph and N color
 * changes are spread across its duration by the easing curve and distributed across cells with
 * *even coverage* (a fresh shuffled picker per pulse), so every glyph is touched once before any
 * repeats — that's what lets a sweep wash the whole specimen evenly rather than clumping. Glyph
 * changes stay within a cell's width class; color changes go to the pulse's `color` target when set,
 * else a weighted-random token. Each change records the cell's prior value, so with `mirror` on it
 * replays in reverse about the midpoint — a palindrome that ends exactly on the opening state for a
 * seamless loop.
 */
function buildEvents(
  pulses: Pulse[],
  mirror: boolean,
  cls: Cls[],
  classes: Classes,
  initial: Cell[],
  charMul: number,
  colorMul: number,
  weights: Record<Token, number>,
): SetEvent[] {
  const sim = initial.map((c) => ({ ...c }));
  const total = pulses.reduce((s, p) => s + Math.max(0, p.duration), 0);
  const forward: { t: number; slot: number; kind: "char" | "color"; from: string; to: string }[] = [];
  let start = 0;
  for (const p of pulses) {
    const d = Math.max(0, p.duration);
    const place = (i: number, n: number): number =>
      start + (p.pacing === "random" ? Math.random() * d : d * ease((i + 1) / (n + 1), p.pacing));
    const nChars = Math.max(0, Math.round((p.chars ?? 0) * charMul));
    const nColors = Math.max(0, Math.round((p.colors ?? 0) * colorMul));
    const nextCharCell = evenCellPicker(sim.length);
    const nextColorCell = evenCellPicker(sim.length);
    for (let i = 0; i < nChars; i++) {
      const slot = nextCharCell();
      const cell = sim[slot];
      if (!cell) continue;
      const list = classes[cls[slot] ?? "regular"].length
        ? classes[cls[slot] ?? "regular"]
        : Object.values(classes).flat();
      const to = differentFromClass(list, 1, cell.text);
      forward.push({ t: place(i, nChars), slot, kind: "char", from: cell.text, to });
      sim[slot] = { ...cell, text: to };
    }
    for (let i = 0; i < nColors; i++) {
      const slot = nextColorCell();
      const cell = sim[slot];
      if (!cell) continue;
      const to = p.color ?? weightedColor(weights, cell.token);
      forward.push({ t: place(i, nColors), slot, kind: "color", from: cell.token, to });
      sim[slot] = { ...cell, token: to };
    }
    start += d;
  }
  const events: SetEvent[] = forward.map((e) => ({ t: e.t, slot: e.slot, kind: e.kind, value: e.to }));
  if (mirror) {
    for (const e of forward) {
      events.push({ t: 2 * total - e.t, slot: e.slot, kind: e.kind, value: e.from });
    }
  }
  return events.sort((a, b) => a.t - b.t);
}

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

/** Demo overlay: the name of the pulse currently playing. Mirror-aware (the reverse half shows the
 *  mirrored pulse) so it reads the same at the loop seam. */
function PulseLabel({
  size,
  pulses,
  clip,
  mirror,
}: {
  size: number;
  pulses: Pulse[];
  clip: number;
  mirror: boolean;
}): React.ReactElement {
  const [name, setName] = useState("");
  const key = JSON.stringify(pulses);
  useEffect(() => {
    let cancelled = false;
    let t0 = 0;
    let id: ReturnType<typeof setInterval> | undefined;
    const total = pulses.reduce((s, p) => s + Math.max(0, p.duration), 0);
    const tick = (): void => {
      let t = clip > 0 ? ((Date.now() - t0) / 1000) % clip : 0;
      if (mirror && t > total) t = 2 * total - t; // reverse half mirrors the forward
      let acc = 0;
      let nm = pulses[pulses.length - 1]?.name ?? "";
      for (const p of pulses) {
        if (t < acc + Math.max(0, p.duration)) {
          nm = p.name ?? "";
          break;
        }
        acc += Math.max(0, p.duration);
      }
      setName(nm);
    };
    void (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      t0 = Date.now();
      tick();
      id = setInterval(tick, 100);
    });
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, [clip, mirror, key]); // eslint-disable-line react-hooks/exhaustive-deps
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
 * A type specimen: one big wrapping string of `characters` glyphs (auto-grouped into width-classed
 * slots) whose glyphs and colors change over a config-composed sequence of "pulses" (mirrored into a
 * seamless loop by default) on a fixed 1920×1080 clip. Slots set their color statefully via UnoCSS
 * attributify tokens (`text="foreground|muted|accent"`) → `--sp-*` CSS variables the wrapper sets from
 * config. Served via `files.<name>`; capture realtime.
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
  const pulsesKey = `${JSON.stringify(pulses)}|${mirror}|${charIntensity}|${colorIntensity}|${JSON.stringify(weights)}`;
  const colors = (options.colors ?? {}) as Record<string, string>;
  const foreground = colors.foreground ?? "#16181d";
  const muted = colors.muted ?? "#a7adb6";
  const accent = colors.accent ?? background; // accent falls back to the backdrop (blends in)
  const labelColor = colors.label ?? foreground; // font-name label falls back to foreground

  // The per-character width classes. Char lists per class are measured after the font loads.
  const specKey = `${characters}|${blacklist}`;
  const spec = useMemo(() => buildSpec(characters, blacklist), [specKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Hold capture until the glyphs are actually on screen. The cells start empty and are only seeded
  // once the font loads, so without this the recorder (which starts at fonts.ready) can grab a blank
  // first frame. We publish a promise the runtime awaits and resolve it after the seed has painted
  // (a double rAF guarantees a committed frame). Created once, synchronously at first render, so the
  // runtime sees it before its own ready check.
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

  // Once the font is loaded: measure it, classify the pool by width, seed the opening cells (each
  // cell a glyph of its class), size the type (unless `fontSize` is set), and schedule the pulses.
  // Gating on fonts.ready lines t=0 up with capture start (recording begins right after play()).
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
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
      const listFor = (cls: Cls): string[] =>
        classes[cls].length ? classes[cls] : [...spec.pool];

      const initial: Cell[] = spec.cls.map((cls, i) => ({
        text: randFromClass(listFor(cls), 1),
        token: (i % 4 === 2 ? "muted" : "foreground") as Token,
      }));
      setCells(initial.map((c) => ({ ...c })));

      if (fontSizeOpt == null) {
        const worst = spec.cls
          .map((cls) => {
            const list = listFor(cls);
            return list.reduce((w, c) => ((adv[c] ?? 0) > (adv[w] ?? -1) ? c : w), list[0] ?? "");
          })
          .join("");
        const fits = (size: number): boolean =>
          wrapLineCount(worst, adv, (lineWidth / size) * 0.99) * LEADING * size <= typeArea;
        let lo = 16;
        let hi = Math.floor(typeArea / LEADING);
        while (hi - lo > 1) {
          const m = (lo + hi) >> 1;
          if (fits(m)) lo = m;
          else hi = m;
        }
        setFit(lo);
      }

      // Glyphs are seeded and the type is sized — let the runtime start capturing once this paints.
      markPainted();

      for (const ev of buildEvents(
        pulses,
        mirror,
        spec.cls,
        classes,
        initial,
        charIntensity,
        colorIntensity,
        weights,
      )) {
        timers.push(
          setTimeout(() => {
            setCells((prev) => {
              const cur = prev[ev.slot];
              if (!cur) return prev;
              const next = prev.slice();
              next[ev.slot] =
                ev.kind === "char"
                  ? { ...cur, text: ev.value }
                  : { ...cur, token: ev.value as Token };
              return next;
            });
          }, ev.t * 1000),
        );
      }
    };
    void (document.fonts?.ready ?? Promise.resolve()).then(setup);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [specKey, pulsesKey, weight, lineWidth, typeArea, fontSizeOpt]); // eslint-disable-line react-hooks/exhaustive-deps

  const fontSize = fontSizeOpt ?? fit ?? Math.round(typeArea / (3 * LEADING));

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
              lineHeight: LEADING,
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
          {demo && <PulseLabel size={barH} pulses={pulses} clip={durationSeconds} mirror={mirror} />}
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
