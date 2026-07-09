/**
 * The specimen's animation timeline as pure, DOM-free data + functions, so that:
 *  - the schedule is DETERMINISTIC: every random draw goes through an injected seeded PRNG. The
 *    frame-stepper renders chunks in parallel browser contexts — each loads the page independently,
 *    so all of them must compute the *identical* schedule or glyphs would jump at chunk boundaries.
 *  - state is a function of time (`createCursor().stateAt(t)`), letting the capture runtime seek
 *    the scene to any frame instead of replaying wall-clock timers.
 *  - the logic is unit-testable from Node (see test/specimen-timeline.test.ts).
 *
 * Layout model: glyphs are packed into a fixed number of LEFT-ALIGNED lines, each filled to a
 * target width using the font's real advance widths (`packAndSeedLines`). Glyph changes are then
 * scheduled as width-compensated pairs that keep every line's total width within a small budget
 * (`maxLineDrift`), so the right edge barely moves as the wall animates (`buildEvents`).
 */

export type Token = "foreground" | "muted" | "accent";

export interface Cell {
  text: string;
  token: Token;
}

/** One beat of the animation: glyph/color changes spread across its duration (0/0 = a hold). */
export interface Pulse {
  name?: string;
  duration: number;
  /** Fraction of cells whose glyph changes during this beat (0..1; 1 = every cell once). */
  chars?: number;
  /** Fraction of cells whose color changes during this beat (0..1; 1 = every cell once). */
  colors?: number;
  /** When set, every color change in the beat targets this exact token (a sweep) — else weighted. */
  color?: Token;
  pacing?: "even" | "linear" | "ease-in" | "ease-out" | "ease-in-out" | "random";
}

/** A scheduled change that sets one cell's glyph or color to an exact value at an absolute time. */
export interface SetEvent {
  t: number;
  slot: number;
  kind: "char" | "color";
  value: string;
}

export type Rng = () => number;

/** Glyphs a specimen draws from (uppercase + digits + a few symbols), minus any blacklist. */
export const MASTER_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$%&@#*+=";

const TOKENS: Token[] = ["foreground", "muted", "accent"];
export const DEFAULT_WEIGHTS: Record<Token, number> = { foreground: 2, muted: 2, accent: 1 };

/** Fallback advance (em) for an unmeasured glyph — only hit if a pool char wasn't measured. */
const FALLBACK_ADV = 0.6;

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

/** Effective glyph pool from config: the master pool minus the blacklist (never empty). */
export function buildSpec(blacklist: string, masterPool: string = MASTER_POOL): { pool: string } {
  const black = new Set(blacklist.toUpperCase().split(""));
  let pool = [...masterPool].filter((c) => !black.has(c)).join("");
  if (!pool) pool = masterPool;
  return { pool };
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
  return pool[pool.length - 1] as Token; //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
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
        [bag[i], bag[j]] = [bag[j] as number, bag[i] as number]; //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
      }
    }
    const next = bag.pop();
    return next ?? 0; // bag is refilled above when empty, so this is never undefined
  };
}

/** Easing curve mapping an even fraction (0..1) to a time fraction within a beat, like CSS easing. */
function ease(u: number, pacing: Pulse["pacing"]): number {
  switch (pacing) {
    case "ease-in":
      return u * u;
    case "ease-out":
      return 1 - (1 - u) * (1 - u);
    case "ease-in-out":
      return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
    default:
      return u;
  }
}

/** Sum of the pulse durations (the forward half; a mirrored clip is twice this). */
export function totalDuration(pulses: Pulse[]): number {
  return pulses.reduce((s, p) => s + Math.max(0, p.duration), 0);
}

export interface PackedLayout {
  /** Flat array of glyph cells (lines concatenated left-to-right, top-to-bottom). */
  cells: Cell[];
  /** Number of cells in each line (sums to cells.length). */
  lineLengths: number[];
  /** Each line's initial total advance width, in em (advance per 1px of font size). */
  lineInitialEm: number[];
}

/**
 * Pack `lines` left-aligned lines, each greedily filled with seeded-random glyphs to just under
 * `targetEm` (the per-line width budget, in em) using the font's real advances — so every line is
 * about the same length and the right edge sits near the frame edge. `minPerLine` guards against a
 * huge font producing 1–2-glyph lines (it may then slightly overshoot `targetEm`). Pure given the
 * rng, so every parallel capture worker computes the identical wall.
 */
export function packAndSeedLines(opts: {
  lines: number;
  targetEm: number;
  adv: Record<string, number>;
  pool: string;
  rng: Rng;
  minPerLine: number;
}): PackedLayout {
  const { targetEm, adv, pool, rng } = opts;
  const poolArr = [...pool];
  const lines = Math.max(1, Math.floor(opts.lines));
  const minPerLine = Math.max(1, Math.floor(opts.minPerLine));
  const advOf = (g: string): number => adv[g] ?? FALLBACK_ADV;

  const cells: Cell[] = [];
  const lineLengths: number[] = [];
  const lineInitialEm: number[] = [];
  let idx = 0;

  for (let L = 0; L < lines; L++) {
    let em = 0;
    let count = 0;
    for (;;) {
      const g = poolArr[Math.floor(rng() * poolArr.length)] ?? poolArr[0] ?? "A";
      const a = advOf(g);
      if (count >= minPerLine && em + a > targetEm) break;
      cells.push({ text: g, token: idx % 4 === 2 ? "muted" : "foreground" });
      em += a;
      count++;
      idx++;
      if (count >= 512) break;
    }
    lineLengths.push(count);
    lineInitialEm.push(em);
  }
  return { cells, lineLengths, lineInitialEm };
}

/** cell index → line index, derived from per-line counts. */
function lineOfCells(lineLengths: number[], n: number): number[] {
  const lineOf = new Array<number>(n).fill(0);
  let c = 0;
  for (let L = 0; L < lineLengths.length; L++) {
    for (let k = 0; k < (lineLengths[L] ?? 0) && c < n; k++) lineOf[c++] = L;
  }
  return lineOf;
}

/**
 * Replay a built schedule and return the maximum relative line-width drift across all lines and all
 * (time-grouped) frames — the "≤ maxLineDrift" guarantee, computable from Node tests and used at
 * runtime to warn on a degenerate (too-small) pool. Events at the same time are applied together
 * (compensating pairs flip simultaneously), so only the rendered net is measured.
 */
export function maxLineDrift(initial: Cell[], events: SetEvent[], adv: Record<string, number>, lineLengths: number[]): number {
  const lineInitialEm = lineLengths.map(() => 0);
  const lineOf = lineOfCells(lineLengths, initial.length);
  const advOf = (g: string): number => adv[g] ?? FALLBACK_ADV;
  initial.forEach((c, i) => {
    const L = lineOf[i] as number; //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
    lineInitialEm[L] = (lineInitialEm[L] as number) + advOf(c.text); //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
  });
  let i = 0;
  let maxRel = 0;
  const lineEm = lineInitialEm.slice();
  const text = initial.map((c) => c.text);
  const sorted = [...events].sort((a, b) => a.t - b.t);
  while (i < sorted.length) {
    const t = (sorted[i] as SetEvent).t; //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
    while (i < sorted.length && (sorted[i] as SetEvent).t === t) { //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
      const ev = sorted[i] as SetEvent; //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
      if (ev.kind === "char") {
        const L = lineOf[ev.slot] as number; //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
        lineEm[L] = (lineEm[L] as number) + advOf(ev.value) - advOf(text[ev.slot] as string); //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
        text[ev.slot] = ev.value;
      }
      i++;
    }
    for (let L = 0; L < lineLengths.length; L++) {
      const init = lineInitialEm[L] as number; //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
      const rel = init > 0 ? Math.abs((lineEm[L] as number) - init) / init : 0; //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
      if (rel > maxRel) maxRel = rel;
    }
  }
  return maxRel;
}

/**
 * Build the full change schedule, one pulse at a time. `chars`/`colors` are FRACTIONS of the cell
 * count `N`; the even-coverage picker spreads them so a sweep (e.g. `colors: 1`) lands on every cell
 * once. GLYPH changes are scheduled as width-compensated PAIRS: two adjacent same-line cells flip at
 * the same instant, chosen so the pair's total advance is ~unchanged, keeping each line's width
 * within `tol` of its initial (so the left-aligned right edge barely shifts). COLOR changes don't
 * affect width and are unchanged. Each change records its prior value so `mirror` replays in reverse
 * about the midpoint — a palindrome that ends exactly on the opening state for a seamless loop.
 * Deterministic given the same rng seed and inputs.
 */
export function buildEvents(
  pulses: Pulse[],
  mirror: boolean,
  initial: Cell[],
  adv: Record<string, number>,
  pool: string,
  lineLengths: number[],
  lineInitialEm: number[],
  charMul: number,
  colorMul: number,
  weights: Record<Token, number>,
  tol: number,
  rng: Rng,
): SetEvent[] {
  const N = initial.length;
  const poolArr = [...pool];
  const lineEm = lineInitialEm.slice();
  const lineOf = lineOfCells(lineLengths, N);
  const lineLo = lineInitialEm.map((e) => e * (1 - tol));
  const lineHi = lineInitialEm.map((e) => e * (1 + tol));
  const advOf = (g: string): number => adv[g] ?? FALLBACK_ADV;
  const inBudget = (L: number, deltaEm: number): boolean => {
    const e = (lineEm[L] as number) + deltaEm; //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
    return e >= (lineLo[L] as number) && e <= (lineHi[L] as number); //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
  };

  const differentFrom = (not: string): string => {
    for (let i = 0; i < 8; i++) {
      const s = poolArr[Math.floor(rng() * poolArr.length)] ?? "";
      if (s && s !== not) return s;
    }
    return poolArr[Math.floor(rng() * poolArr.length)] ?? not;
  };
  const closestAdvance = (target: number, exclude: string): string => {
    let best = "";
    let err = Infinity;
    for (const g of poolArr) {
      if (g === exclude) continue;
      const e = Math.abs(advOf(g) - target);
      if (e < err) {
        err = e;
        best = g;
      }
    }
    return best || exclude;
  };
  /** A single in-budget glyph change for `g0` in line `L` (closest-width fallback if none fits). */
  const pickInBudget = (L: number, g0: string): string => {
    const a0 = advOf(g0);
    const valid: string[] = [];
    for (const g of poolArr) {
      if (g === g0) continue;
      if (inBudget(L, advOf(g) - a0)) valid.push(g);
    }
    if (valid.length) return valid[Math.floor(rng() * valid.length)] as string; //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
    return closestAdvance(a0, g0);
  };

  let start = 0;
  const total = totalDuration(pulses);
  const sim = initial.map((c) => ({ ...c }));
  const forward: { t: number; slot: number; kind: "char" | "color"; from: string; to: string }[] = [];

  for (const p of pulses) {
    const d = Math.max(0, p.duration);
    const place = (i: number, n: number): number =>
      start + (p.pacing === "random" ? rng() * d : d * ease((i + 1) / (n + 1), p.pacing));

    let nChars = Math.max(0, Math.round((p.chars ?? 0) * charMul * N));
    nChars -= nChars % 2;
    const nPairs = nChars / 2;
    const nextCharCell = evenCellPicker(rng, N);
    const applySingle = (t: number, slot: number): void => {
      const cell = sim[slot];
      if (!cell) return;
      const L = lineOf[slot] as number; //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
      const g1 = pickInBudget(L, cell.text);
      if (g1 === cell.text) return;
      forward.push({ t, slot, kind: "char", from: cell.text, to: g1 });
      lineEm[L] = (lineEm[L] as number) + advOf(g1) - advOf(cell.text); //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
      sim[slot] = { ...cell, text: g1 };
    };
    for (let i = 0; i < nPairs; i++) {
      const t = place(i, nPairs);
      const cA = nextCharCell();
      const cellA = sim[cA];
      if (!cellA) continue;
      const L = lineOf[cA] as number; //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
      let cB = -1;
      if (cA + 1 < N && lineOf[cA + 1] === L) cB = cA + 1;
      else if (cA - 1 >= 0 && lineOf[cA - 1] === L) cB = cA - 1;

      if (cB < 0) {
        applySingle(t, cA);
        continue;
      }
      const cellB = sim[cB];
      if (!cellB) {
        applySingle(t, cA);
        continue;
      }
      const g0 = cellA.text;
      const h0 = cellB.text;
      const pairSum0 = advOf(g0) + advOf(h0);
      let chosen: { g1: string; h1: string; net: number } | null = null;
      for (let tries = 0; tries < 6 && !chosen; tries++) {
        const g1 = differentFrom(g0);
        const h1 = closestAdvance(pairSum0 - advOf(g1), h0);
        const net = advOf(g1) + advOf(h1) - pairSum0;
        if (inBudget(L, net)) chosen = { g1, h1, net };
      }
      if (!chosen) {
        applySingle(t, cA);
        continue;
      }
      forward.push({ t, slot: cA, kind: "char", from: g0, to: chosen.g1 });
      forward.push({ t, slot: cB, kind: "char", from: h0, to: chosen.h1 });
      lineEm[L] = (lineEm[L] as number) + chosen.net; //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
      sim[cA] = { ...cellA, text: chosen.g1 };
      sim[cB] = { ...cellB, text: chosen.h1 };
    }

    const nColors = Math.max(0, Math.round((p.colors ?? 0) * colorMul * N));
    const nextColorCell = evenCellPicker(rng, N);
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
  let idx = 0;
  let lastT = -Infinity;
  let cells = initial.map((c) => ({ ...c }));
  return {
    stateAt(t: number): Cell[] {
      if (t < lastT) {
        cells = initial.map((c) => ({ ...c }));
        idx = 0;
      }
      lastT = t;
      while (idx < events.length && (events[idx] as SetEvent).t <= t) { //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
        const ev = events[idx] as SetEvent; //EXCUSE: in-bounds index; noUncheckedIndexedAccess widens the element type to T | undefined
        const cur = cells[ev.slot];
        if (cur) {
          //EXCUSE: color events carry a Token in their string `value` field by construction
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
  if (mirror && tt > total) tt = 2 * total - tt;
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
