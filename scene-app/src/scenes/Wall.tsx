import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { SceneProps } from "../types";
import { assignTiles, offsetX, offsetY, planColumns, type Dir } from "./wall-motion";

/**
 * A wall of media tiles (the captured videos + screenshots, cycled across the grid). The whole wall
 * pans slowly on X while each column scrolls on Y at its own seeded, varying speed (columns
 * alternating up/down). All motion is a deterministic function of time, published via
 * `window.__sceneSeek(t)` so the frame-stepper can render it frame-exact and loop seamlessly: each
 * offset completes an integer number of cycles over the clip, so position(t=D) ≡ position(0). Tiles
 * and column copies are duplicated ×2 per axis so the marquee wraps without a seam. Tile videos are
 * runtime-managed (they loop via the runtime's seek), so the wall only drives the transforms.
 */
const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

interface Layout {
  columns: { tiles: string[]; loopsY: number; dir: Dir }[];
  tileW: number;
  tileH: number;
  gap: number;
  radius: number;
  periodX: number;
  periodY: number;
  copiesY: number;
  panLoops: number;
  panDir: Dir;
}

function computeLayout(
  width: number,
  height: number,
  urls: string[],
  o: Record<string, unknown>,
): Layout {
  const num = (k: string, d: number): number => (typeof o[k] === "number" ? (o[k] as number) : d);
  const columnsN = Math.max(1, Math.min(12, Math.round(num("columns", 5))));
  const gap = Math.max(0, Math.round(num("gap", 16)));
  const tileAspect = Math.max(0.2, num("tileAspect", 1.6));
  const radius = Math.max(0, Math.round(num("cornerRadius", 12)));
  const panLoops = Math.max(0, Math.round(num("panLoops", 1)));
  const panDir: Dir = o.panDirection === "right" ? -1 : 1;
  const seed = Math.round(num("seed", 1));
  const scrollLoopsMin = Math.max(1, Math.round(num("scrollLoopsMin", 2)));
  const scrollLoopsMax = Math.max(1, Math.round(num("scrollLoopsMax", 4)));
  const alternate = o.alternate !== false;

  // Columns fill the width exactly (unitX = tileW + gap = width/columns), so one column-set spans
  // the viewport and the ×2 horizontal copies tile the pan seamlessly.
  const tileW = Math.max(40, Math.round(width / columnsN - gap));
  const tileH = Math.max(40, Math.round(tileW / tileAspect));
  const unitY = tileH + gap;
  const tilesPerColumn = Math.ceil(height / unitY) + 1; // one full set already overflows the height
  const periodY = tilesPerColumn * unitY;
  const periodX = columnsN * (tileW + gap);

  const grid = assignTiles(urls, columnsN, tilesPerColumn);
  const plans = planColumns(seed, columnsN, { scrollLoopsMin, scrollLoopsMax, alternate });
  const columns = grid.map((tiles, c) => ({
    tiles,
    loopsY: plans[c]?.loopsY ?? scrollLoopsMin,
    dir: plans[c]?.dir ?? 1,
  }));

  return { columns, tileW, tileH, gap, radius, periodX, periodY, copiesY: 2, panLoops, panDir };
}

const cover: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

function Tile({ url, w, h, radius }: { url: string; w: number; h: number; radius: number }): React.ReactElement {
  const isVideo = VIDEO_RE.test(url);
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        overflow: "hidden",
        flex: "0 0 auto",
        background: "#000",
      }}
    >
      {url ? (
        isVideo ? (
          <video data-scene-video src={url} muted playsInline preload="auto" style={cover} />
        ) : (
          <img src={url} alt="" style={cover} />
        )
      ) : null}
    </div>
  );
}

export function Wall({
  width,
  height,
  background,
  durationSeconds,
  inputs,
  options,
}: SceneProps): React.ReactElement {
  const urls = useMemo(() => Object.values(inputs).filter(Boolean), [inputs]);
  const layoutKey = `${width}x${height}|${JSON.stringify(options)}|${urls.join(",")}`;
  const layout = useMemo(() => computeLayout(width, height, urls, options), [layoutKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [motion, setMotion] = useState<{ x: number; ys: number[] }>(() => ({
    x: 0,
    ys: layout.columns.map(() => 0),
  }));

  // Readiness gate (mirror the specimen): hold capture until the wall's layout has painted. Created
  // once, synchronously at first render, so the runtime sees it before its own ready check. The
  // runtime separately waits for the tile videos to load.
  const sceneReady = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!sceneReady.current) {
    let resolve: () => void = () => {};
    const promise = new Promise<void>((r) => (resolve = r));
    sceneReady.current = { promise, resolve };
    window.__sceneReady = promise;
  }

  useEffect(() => {
    // The timeline hook: the frame-stepper seeks this; flushSync commits the transforms to the DOM
    // before the runtime's trailing rAF + screenshot, so every frame shows exactly its time's state.
    window.__sceneSeek = (t: number) => {
      flushSync(() => {
        setMotion({
          x: offsetX(layout.panLoops, layout.panDir, t, durationSeconds, layout.periodX),
          ys: layout.columns.map((c) => offsetY(c.loopsY, c.dir, t, durationSeconds, layout.periodY)),
        });
      });
    };
    requestAnimationFrame(() => requestAnimationFrame(() => sceneReady.current?.resolve()));
    return () => {
      delete window.__sceneSeek;
    };
  }, [layoutKey, durationSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const root: React.CSSProperties = { position: "absolute", inset: 0, overflow: "hidden", background };
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

  const renderColumn = (col: Layout["columns"][number], c: number): React.ReactElement => (
    <div key={c} style={{ width: layout.tileW, marginRight: layout.gap, flex: "0 0 auto" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          transform: `translateY(${-(motion.ys[c] ?? 0)}px)`,
          willChange: "transform",
        }}
      >
        {/* Two stacked copies so a scroll up to one full period always has content below. */}
        {Array.from({ length: layout.copiesY }).flatMap((_, copy) =>
          col.tiles.map((url, r) => (
            <div key={`${copy}-${r}`} style={{ marginBottom: layout.gap }}>
              <Tile url={url} w={layout.tileW} h={layout.tileH} radius={layout.radius} />
            </div>
          )),
        )}
      </div>
    </div>
  );

  return (
    <div style={root}>
      <div style={xpan}>
        {/* Two side-by-side copies of the column-set so the X pan wraps seamlessly. */}
        {[0, 1].map((copy) => (
          <div key={copy} style={colset}>
            {layout.columns.map(renderColumn)}
          </div>
        ))}
      </div>
    </div>
  );
}
