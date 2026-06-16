import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { SceneProps } from "../types";
import { trackOffset, type Dir, type PulseInput, type Track } from "./wall-motion";

/** One column's config (scene wire format): its tiles (asset slot names) + its own optional motion. */
interface WallColumnOpt {
  tiles?: string[];
  direction?: "up" | "down";
  loops?: number;
  pulses?: PulseInput[];
  stagger?: number;
}

/** The wall's X-pan config (scene wire format). */
interface WallPanOpt {
  direction?: "left" | "right";
  loops?: number;
  pulses?: PulseInput[];
}

/** A faux tile spec for `test` preview mode. */
interface FauxTileOpt {
  color?: string;
  size?: string;
  aspect?: number;
}

/** A resolved tile: either a real asset url, or a faux color box (test mode). Faux tiles carry their
 *  own aspect so the preview shows the same mixed-height layout the real (natural-sized) media will. */
type Cell =
  | { kind: "asset"; url: string }
  | { kind: "faux"; color: string; label: string; size?: string; aspect: number };

/**
 * A wall of media tiles. Every tile fills its column's WIDTH and takes its OWN height from its media's
 * aspect ratio — a 16:9 tile is short, a 9:16 tile is tall — so the columns read as a natural masonry
 * rather than a rigid grid. Motion is two independent systems built from one pulse primitive (see
 * wall-motion.ts): System 1 pans the whole wall on X, System 2 scrolls each column on Y (its own
 * direction / base loops / pulses).
 *
 * Because tile heights come from the real media, a column's scroll PERIOD (the height of one set of
 * its tiles, the repeat unit) isn't known until the media has loaded — so it's measured from the DOM
 * once everything is loaded, and each column repeats its set enough times (`copies`) to cover the
 * viewport during a full period of travel. Every track's whole-clip travel rounds up to an integer
 * number of periods, so each lands back on its start → seamless. All motion is a deterministic
 * function of time, published via `window.__sceneSeek(t)` for frame-exact capture. In `test` mode
 * tiles are faux color boxes (no real assets, aspect from config) so layout + motion can be previewed
 * without running producers.
 */
const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/** Deterministic distinct color per tile name, for faux tiles without an explicit `color`. */
function autoColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 42%, 46%)`;
}

interface Layout {
  columns: { cells: Cell[]; track: Track }[];
  pan: Track;
  tileW: number;
  gap: number;
  radius: number;
  periodX: number;
  /** Default/fallback aspect, used to estimate a column's period before its media has measured. */
  fallbackAspect: number;
}

function computeLayout(
  width: number,
  inputs: Record<string, string>,
  o: Record<string, unknown>,
): Layout {
  const num = (k: string, d: number): number => (typeof o[k] === "number" ? (o[k] as number) : d);

  // Each column owns its tiles (asset slot names) + its own motion. Count = array length.
  const colDefs = Array.isArray(o.columns) ? (o.columns as WallColumnOpt[]) : [];
  const columnsN = Math.max(1, colDefs.length);
  const gap = Math.max(0, Math.round(num("gap", 8)));
  const fallbackAspect = Math.max(0.2, num("tileAspect", 0.75));
  const radius = Math.max(0, Math.round(num("cornerRadius", 6)));

  // Preview mode: render faux color boxes instead of resolving real assets.
  const test = o.test === true;
  const testTiles =
    o.testTiles && typeof o.testTiles === "object"
      ? (o.testTiles as Record<string, FauxTileOpt>)
      : {};

  // Wall-level motion defaults inherited by columns that omit their own.
  const defaultLoops = Math.max(0, num("loops", 0));
  const defaultPulses = Array.isArray(o.pulses) ? (o.pulses as PulseInput[]) : [];

  const panOpt: WallPanOpt = o.pan && typeof o.pan === "object" ? (o.pan as WallPanOpt) : {};
  const pan: Track = {
    pulses: panOpt.pulses ?? [],
    loops: Math.max(0, panOpt.loops ?? 0),
    dir: panOpt.direction === "right" ? -1 : 1,
  };

  // Columns fill the width exactly (unitX = tileW + gap = width/columns), so one column-set spans
  // the viewport and the ×2 horizontal copies tile the pan seamlessly.
  const tileW = Math.max(40, Math.round(width / columnsN - gap));
  const periodX = columnsN * (tileW + gap);

  const columns = colDefs.map((c) => {
    const names = c.tiles ?? [];
    const cells: Cell[] = test
      ? names.map((name) => {
          const f = testTiles[name] ?? {};
          return {
            kind: "faux",
            color: f.color ?? autoColor(name),
            label: name,
            size: f.size,
            aspect: typeof f.aspect === "number" && f.aspect > 0 ? f.aspect : fallbackAspect,
          };
        })
      : (names.map((name) => inputs[name]).filter(Boolean) as string[]).map((url) => ({
          kind: "asset" as const,
          url,
        }));
    // Omitted direction defaults to "down"; omitted loops/pulses inherit the wall defaults.
    const dir: Dir = c.direction === "up" ? 1 : -1;
    const track: Track = {
      pulses: c.pulses ?? defaultPulses,
      loops: Math.max(0, c.loops ?? defaultLoops),
      dir,
      stagger: typeof c.stagger === "number" ? c.stagger : 0,
    };
    return { cells, track };
  });

  return { columns, pan, tileW, gap, radius, periodX, fallbackAspect };
}

const media: React.CSSProperties = { width: "100%", height: "auto", display: "block" };

/** A single tile: it spans the column width and takes its height from its media's natural aspect
 *  (asset) or its configured `aspect` (faux). No fixed box / cropping — the media defines the size. */
function Tile({
  cell,
  w,
  radius,
  background,
}: {
  cell: Cell;
  w: number;
  radius: number;
  background: string;
}): React.ReactElement {
  const frame: React.CSSProperties = {
    width: w,
    borderRadius: radius,
    overflow: "hidden",
    background: cell.kind === "faux" ? cell.color : background,
  };
  if (cell.kind === "faux") {
    return (
      <div
        style={{
          ...frame,
          aspectRatio: String(cell.aspect),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          padding: 8,
          boxSizing: "border-box",
          textAlign: "center",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          wordBreak: "break-word",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: Math.max(12, Math.round(w * 0.1)), lineHeight: 1.1 }}>
          {cell.label}
        </span>
        {cell.size ? (
          <span style={{ fontSize: Math.max(10, Math.round(w * 0.065)), opacity: 0.8 }}>{cell.size}</span>
        ) : null}
      </div>
    );
  }
  return (
    <div style={frame}>
      {VIDEO_RE.test(cell.url) ? (
        <video data-scene-video src={cell.url} muted playsInline preload="auto" style={media} />
      ) : cell.url ? (
        <img src={cell.url} alt="" style={media} />
      ) : null}
    </div>
  );
}

/** Estimate a column's period (px) from the fallback aspect, used until the DOM is measured. */
function estimatePeriod(cellCount: number, tileW: number, gap: number, aspect: number): number {
  if (cellCount <= 0) return 0;
  const tileH = Math.round(tileW / aspect);
  return cellCount * tileH + cellCount * gap; // one set + its trailing inter-set gap
}

/** How many copies of a column's tile-set to stack so the marquee always has content during a full
 *  period of travel. The stack is `copies` sets with `gap` between them, i.e. height
 *  `copies·period − gap`; it must cover one period (the offset range) plus the viewport, which gives
 *  `copies ≥ 1 + ⌈(viewport + gap) / period⌉`. Clamped so an all-failed (zero-height) column can't
 *  explode into thousands of tiles. */
function copiesFor(period: number, viewport: number, gap: number): number {
  if (!(period > 0)) return 1;
  return Math.min(50, Math.max(2, 1 + Math.ceil((viewport + gap) / period)));
}

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

/** Resolve once every <img>/<video> under `root` has its intrinsic size (or has errored/timed out),
 *  so a measurement reads the real, laid-out tile heights rather than zero-height placeholders. */
function whenMediaSized(root: HTMLElement): Promise<void> {
  const waits: Promise<void>[] = [];
  for (const img of Array.from(root.querySelectorAll("img"))) {
    if (img.complete && img.naturalWidth > 0) continue;
    waits.push(
      new Promise((resolve) => {
        const done = (): void => {
          img.removeEventListener("load", done);
          img.removeEventListener("error", done);
          resolve();
        };
        img.addEventListener("load", done);
        img.addEventListener("error", done);
      }),
    );
  }
  for (const v of Array.from(root.querySelectorAll("video"))) {
    if (v.readyState >= 1 /* HAVE_METADATA */ && v.videoWidth > 0) continue;
    waits.push(
      new Promise((resolve) => {
        const done = (): void => {
          v.removeEventListener("loadedmetadata", done);
          v.removeEventListener("error", done);
          resolve();
        };
        v.addEventListener("loadedmetadata", done);
        v.addEventListener("error", done);
      }),
    );
  }
  if (waits.length === 0) return Promise.resolve();
  // Hard cap so a stuck media element can never hang capture.
  return Promise.race([
    Promise.all(waits).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 15_000)),
  ]);
}

export function Wall({
  width,
  height,
  background,
  durationSeconds,
  inputs,
  options,
}: SceneProps): React.ReactElement {
  const layoutKey = `${width}x${height}|${JSON.stringify(options)}|${JSON.stringify(inputs)}`;
  const layout = useMemo(() => computeLayout(width, inputs, options), [layoutKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Backdrop shown in the padding gaps and behind tiles — the wall sceneOption overrides the
  // scene's background prop when set.
  const bg = typeof options.background === "string" ? options.background : background;

  // Per-column scroll period (px) = the height of ONE set of that column's tiles + its trailing gap.
  // Seeded from the fallback aspect, then replaced with the DOM-measured value once media has loaded.
  const initialPeriods = useMemo(
    () =>
      layout.columns.map((c) =>
        estimatePeriod(c.cells.length, layout.tileW, layout.gap, layout.fallbackAspect),
      ),
    [layoutKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [periods, setPeriods] = useState<number[]>(initialPeriods);
  // Mirror periods into a ref so the (long-lived) seek closure always reads the latest measurement.
  const periodsRef = useRef<number[]>(initialPeriods);
  periodsRef.current = periods;

  const [motion, setMotion] = useState<{ x: number; ys: number[] }>(() => ({
    x: 0,
    ys: layout.columns.map(() => 0),
  }));

  const rootRef = useRef<HTMLDivElement | null>(null);
  // First-set wrapper per column — we measure its height to get the column's period.
  const setRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Readiness gate (mirror the specimen): hold capture until the wall's tiles have loaded, the
  // periods are measured, and the laid-out result has painted. Created once, synchronously at first
  // render, so the runtime sees it before its own ready check.
  const sceneReady = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!sceneReady.current) {
    let resolve: () => void = () => {};
    const promise = new Promise<void>((r) => (resolve = r));
    sceneReady.current = { promise, resolve };
    window.__sceneReady = promise;
  }

  // Measure each column's set height once its media is sized, then release the readiness gate.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const root = rootRef.current;
      if (root) await whenMediaSized(root);
      // Two frames for the browser to lay out the now-sized media before we read heights.
      await nextFrame();
      await nextFrame();
      if (cancelled) return;
      const measured = layout.columns.map((_, c) => {
        const el = setRefs.current[c];
        // The set wrapper holds one set of tiles (gaps between them); the repeat unit adds one more
        // gap before the next set, so the period is the wrapper's height + one gap.
        return el && el.offsetHeight > 0 ? el.offsetHeight + layout.gap : 0;
      });
      setPeriods(measured);
      periodsRef.current = measured;
      // Two frames so the re-render with measured periods (and the right `copies`) has committed and
      // painted before capture is allowed to begin.
      await nextFrame();
      await nextFrame();
      if (!cancelled) sceneReady.current?.resolve();
    })();
    return () => {
      cancelled = true;
    };
  }, [layoutKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // The timeline hook: the frame-stepper seeks this; flushSync commits the transforms to the DOM
    // before the runtime's trailing rAF + screenshot, so every frame shows exactly its time's state.
    // System 1 (pan) and System 2 (per-column) are evaluated independently; each column uses its own
    // measured period (read live from the ref).
    window.__sceneSeek = (t: number) => {
      flushSync(() => {
        setMotion({
          x: trackOffset(layout.pan, t, layout.periodX, durationSeconds),
          ys: layout.columns.map((col, c) =>
            trackOffset(col.track, t, periodsRef.current[c] ?? 0, durationSeconds),
          ),
        });
      });
    };
    return () => {
      delete window.__sceneSeek;
    };
  }, [layoutKey, durationSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const root: React.CSSProperties = { position: "absolute", inset: 0, overflow: "hidden", background: bg };
  const xpan: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    display: "flex",
    width: layout.periodX * 2,
    transform: `translateX(${-motion.x}px)`,
    willChange: "transform",
  };
  const colset: React.CSSProperties = { display: "flex", width: layout.periodX, flex: "0 0 auto" };

  const renderColumn = (
    col: Layout["columns"][number],
    c: number,
    copy: number,
  ): React.ReactElement => {
    const period = periods[c] ?? 0;
    const copies = copiesFor(period, height, layout.gap);
    return (
      <div
        key={c}
        style={{ width: layout.tileW, marginRight: layout.gap, height, overflow: "hidden", flex: "0 0 auto" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: layout.gap,
            transform: `translateY(${-(motion.ys[c] ?? 0)}px)`,
            willChange: "transform",
          }}
        >
          {Array.from({ length: copies }).map((_, set) => (
            <div
              key={set}
              // Measure only the first set of the FIRST horizontal copy (they're identical).
              ref={
                copy === 0 && set === 0
                  ? (el) => {
                      setRefs.current[c] = el;
                    }
                  : undefined
              }
              style={{ display: "flex", flexDirection: "column", gap: layout.gap }}
            >
              {col.cells.map((cell, r) => (
                <Tile key={r} cell={cell} w={layout.tileW} radius={layout.radius} background={bg} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={root} ref={rootRef}>
      <div style={xpan}>
        {/* Two side-by-side copies of the column-set so the X pan wraps seamlessly. */}
        {[0, 1].map((copy) => (
          <div key={copy} style={colset}>
            {layout.columns.map((col, c) => renderColumn(col, c, copy))}
          </div>
        ))}
      </div>
    </div>
  );
}
