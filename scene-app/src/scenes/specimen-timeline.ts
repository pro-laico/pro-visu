/**
 * The specimen's animation timeline as pure, DOM-free data + functions, so that:
 *  - the schedule is DETERMINISTIC: every random draw goes through an injected seeded PRNG. The
 *    frame-stepper renders chunks in parallel browser contexts — each loads the page independently,
 *    so all of them must compute the *identical* schedule or glyphs would jump at chunk boundaries.
 *  - state is a function of time (`createCursor().stateAt(t)`), letting the capture runtime seek
 *    the scene to any frame instead of replaying wall-clock timers.
 *  - the logic is unit-testable from Node (see test/specimen-timeline.test.ts).
 */

export type Cls = "thin" | "regular" | "wide";
export type Classes = Record<Cls, string[]>;
export type Token = "foreground" | "muted" | "accent";

export interface Cell {
  text: string;
  token: Token;
}

/** One beat of the animation: glyph/color changes spread across its duration (0/0 = a hold). */
export interface Pulse {
  name?: string;
  duration: number;
  chars?: number;
  colors?: number;
  /** When set, every color change in the beat targets this exact token (a sweep) — else weighted. */
  color?: Token;
  pacing?: "even" | "linear" | "ease-in" | "ease-out" | "ease-in-out" | "random";
}

/** A scheduled change that sets one cell's glyph or color to an exact value at an absolute time. */
export interface SetEvent {
  t: number;
  slot: number; // cell index
  kind: "char" | "color";
  value: string;
}

export type Rng = () => number;

/** Glyphs a specimen draws from (uppercase + digits + a few symbols), minus any blacklist. */
export const MASTER_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$%&@#*+=";

// Rotated across cells so the opening string is a balanced mix of widths.
const CLASS_ROTATION: Cls[] = ["regular", "wide", "thin", "regular", "thin", "wide"];

const TOKENS: Token[] = ["foreground", "muted", "accent"];
// Default relative likelihood of each token on a random color change (accent rarer — a pop, not the
// norm). Overridden per-render by the `colorWeights` config.
export const DEFAULT_WEIGHTS: Record<Token, number> = { foreground: 2, muted: 2, accent: 1 };

/**
 * mulberry32 — a tiny, fast, seedable PRNG with good distribution for animation purposes.
 * Same seed ⇒ same sequence, in every browser context and in Node tests.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Effective glyph spec from config: the pool (minus blacklist) and the per-character width class
 *  (one class per glyph cell). Char lists per class are measured later (they depend on the font). */
export function buildSpec(
  characters: number,
  blacklist: string,
  masterPool: string = MASTER_POOL,
): { cls: Cls[]; pool: string } {
  const black = new Set(blacklist.toUpperCase().split(""));
  let pool = [...masterPool].filter((c) => !black.has(c)).join("");
  if (!pool) pool = masterPool; // never let a blacklist empty the pool
  const cls = Array.from(
    { length: Math.max(1, characters) },
    (_, i) => CLASS_ROTATION[i % CLASS_ROTATION.length] ?? "regular",
  );
  return { cls, pool };
}

/** Partition the pool into thin / regular / wide thirds by measured advance. */
export function classify(pool: string, adv: Record<string, number>): Classes {
  const chars = [...pool].sort((a, b) => (adv[a] ?? 0) - (adv[b] ?? 0));
  const n = chars.length;
  const t = Math.max(1, Math.floor(n / 3));
  return {
    thin: chars.slice(0, t),
    regular: chars.slice(t, Math.max(t, n - t)),
    wide: chars.slice(n - t),
  };
}

/**
 * Pick a color token by weight, optionally excluding the current one (so a random recolor actually
 * changes). Tokens with weight 0 are never chosen at random. Falls back to any different token if
 * weighting would otherwise yield nothing.
 */
function weightedColor(rng: Rng, weights: Record<Token, number>, exclude?: Token): Token {
  let pool = TOKENS.filter((t) => t !== exclude && (weights[t] ?? 0) > 0);
  if (!pool.length) pool = TOKENS.filter((t) => t !== exclude);
  if (!pool.length) return exclude ?? "foreground";
  const total = pool.reduce((s, t) => s + (weights[t] ?? 1), 0);
  let r = rng() * total;
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
function evenCellPicker(rng: Rng, count: number): () => number {
  let bag: number[] = [];
  return () => {
    if (!bag.length) {
      bag = Array.from({ length: count }, (_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [bag[i], bag[j]] = [bag[j] as number, bag[i] as number];
      }
    }
    return bag.pop() as number;
  };
}

const randFromClass = (rng: Rng, list: string[]): string =>
  list[Math.floor(rng() * list.length)] ?? "";

/** A random glyph from a class, different from `not` when the class allows it. */
function differentFromClass(rng: Rng, list: string[], not: string): string {
  for (let i = 0; i < 8; i++) {
    const s = randFromClass(rng, list);
    if (s !== not) return s;
  }
  return randFromClass(rng, list);
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

/** Sum of the pulse durations (the forward half; a mirrored clip is twice this). */
export function totalDuration(pulses: Pulse[]): number {
  return pulses.reduce((s, p) => s + Math.max(0, p.duration), 0);
}

/** The opening cells: one glyph per width class, with every 4th-ish cell muted for texture. */
export function buildInitialCells(cls: Cls[], classes: Classes, pool: string, rng: Rng): Cell[] {
  const listFor = (c: Cls): string[] => (classes[c].length ? classes[c] : [...pool]);
  return cls.map((c, i) => ({
    text: randFromClass(rng, listFor(c)),
    token: (i % 4 === 2 ? "muted" : "foreground") as Token,
  }));
}

/**
 * Build the full change schedule, one pulse at a time. Within a pulse the N glyph and N color
 * changes are spread across its duration by the easing curve and distributed across cells with
 * *even coverage* (a fresh shuffled picker per pulse), so every glyph is touched once before any
 * repeats. Glyph changes stay within a cell's width class; color changes go to the pulse's `color`
 * target when set, else a weighted-random token. Each change records the cell's prior value, so
 * with `mirror` on it replays in reverse about the midpoint — a palindrome that ends exactly on the
 * opening state for a seamless loop. Deterministic given the same rng seed and inputs.
 */
export function buildEvents(
  pulses: Pulse[],
  mirror: boolean,
  cls: Cls[],
  classes: Classes,
  initial: Cell[],
  charMul: number,
  colorMul: number,
  weights: Record<Token, number>,
  rng: Rng,
): SetEvent[] {
  const sim = initial.map((c) => ({ ...c }));
  const total = totalDuration(pulses);
  const forward: { t: number; slot: number; kind: "char" | "color"; from: string; to: string }[] = [];
  let start = 0;
  for (const p of pulses) {
    const d = Math.max(0, p.duration);
    const place = (i: number, n: number): number =>
      start + (p.pacing === "random" ? rng() * d : d * ease((i + 1) / (n + 1), p.pacing));
    const nChars = Math.max(0, Math.round((p.chars ?? 0) * charMul));
    const nColors = Math.max(0, Math.round((p.colors ?? 0) * colorMul));
    const nextCharCell = evenCellPicker(rng, sim.length);
    const nextColorCell = evenCellPicker(rng, sim.length);
    for (let i = 0; i < nChars; i++) {
      const slot = nextCharCell();
      const cell = sim[slot];
      if (!cell) continue;
      const list = classes[cls[slot] ?? "regular"].length
        ? classes[cls[slot] ?? "regular"]
        : Object.values(classes).flat();
      const to = differentFromClass(rng, list, cell.text);
      forward.push({ t: place(i, nChars), slot, kind: "char", from: cell.text, to });
      sim[slot] = { ...cell, text: to };
    }
    for (let i = 0; i < nColors; i++) {
      const slot = nextColorCell();
      const cell = sim[slot];
      if (!cell) continue;
      const to = p.color ?? weightedColor(rng, weights, cell.token);
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

export interface TimelineCursor {
  /** The cell state at absolute time t (all events with ev.t <= t applied, in order). */
  stateAt(t: number): Cell[];
}

/**
 * State-as-a-function-of-time over a sorted event list. Seeking forward advances an internal
 * pointer (O(total events) amortized across a whole monotonic pass — the frame-stepper's access
 * pattern); seeking backward resets and replays (realtime restarts). Cell objects are replaced,
 * never mutated, and `stateAt` returns a fresh array — safe to hand straight to React state.
 */
export function createCursor(initial: Cell[], events: SetEvent[]): TimelineCursor {
  let cells = initial.map((c) => ({ ...c }));
  let idx = 0;
  let lastT = -Infinity;
  return {
    stateAt(t: number): Cell[] {
      if (t < lastT) {
        cells = initial.map((c) => ({ ...c }));
        idx = 0;
      }
      lastT = t;
      while (idx < events.length && (events[idx] as SetEvent).t <= t) {
        const ev = events[idx] as SetEvent;
        const cur = cells[ev.slot];
        if (cur) {
          cells[ev.slot] =
            ev.kind === "char" ? { ...cur, text: ev.value } : { ...cur, token: ev.value as Token };
        }
        idx++;
      }
      return cells.slice();
    },
  };
}

/**
 * The name of the pulse playing at clip-time t. Mirror-aware: the reverse half reads the forward
 * pulse it's mirroring, so the label is symmetric about the midpoint and at the loop seam.
 */
export function pulseNameAt(pulses: Pulse[], t: number, mirror: boolean, clip: number): string {
  let tt = clip > 0 ? Math.min(Math.max(0, t), clip) : 0;
  const total = totalDuration(pulses);
  if (mirror && tt > total) tt = 2 * total - tt; // reverse half mirrors the forward
  let acc = 0;
  let name = pulses[pulses.length - 1]?.name ?? "";
  for (const p of pulses) {
    if (tt < acc + Math.max(0, p.duration)) {
      name = p.name ?? "";
      break;
    }
    acc += Math.max(0, p.duration);
  }
  return name;
}
