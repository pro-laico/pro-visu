import { flushSync } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SceneProps } from "../types";
import { autoColumns, evalIcons, makeGrid, type BaseState, type EffectStep, type Grid, type IconState } from "./icons-timeline";

/**
 * An icon-set showcase: a centred grid of uniform icons on a solid backdrop. By default each icon is
 * TINTED via a CSS mask (its shape comes from the file's alpha, its colour from `background-color`),
 * so single-colour icons can be recoloured live — which is what the recolour interactions animate.
 * Set `recolor: false` to render the icons natively (as `<img>`, original colours) — then only the
 * scale / opacity / rotate effects apply.
 *
 * The animation is a pure function of time (see icons-timeline.ts): a list of effect steps is
 * evaluated to a per-icon {scale, colour, opacity, rotate} at `window.__sceneSeek(t)`. The runtime
 * frame-steps it for a frame-exact video, or freezes it at one time for the still-image output.
 */

/** Read a number from the loose scene-option bag with a default. */
function num(o: Record<string, unknown>, k: string, d: number): number {
  return typeof o[k] === "number" ? (o[k] as number) : d; //TODO: replace `as` cast with proper typing
}

interface Layout {
  grid: Grid;
  iconSize: number;
  gap: number;
  padding: number;
  gridW: number;
  gridH: number;
}

function computeLayout(width: number, height: number, count: number, o: Record<string, unknown>): Layout {
  const gap = Math.max(0, num(o, "gap", 32));
  const padding = Math.max(0, num(o, "padding", 64));
  const columns =
    typeof o.columns === "number" && o.columns > 0
      ? Math.round(o.columns)
      : autoColumns(count, width, height);
  const grid = makeGrid(count, columns);

  const availW = Math.max(1, width - padding * 2 - gap * (grid.columns - 1));
  const availH = Math.max(1, height - padding * 2 - gap * (grid.rows - 1));
  const fit = Math.floor(Math.min(availW / grid.columns, availH / grid.rows));
  const override = typeof o.iconSize === "number" && o.iconSize > 0 ? Math.round(o.iconSize) : undefined;
  const iconSize = Math.max(4, override !== undefined ? Math.min(override, fit) : fit);

  const gridW = grid.columns * iconSize + (grid.columns - 1) * gap;
  const gridH = grid.rows * iconSize + (grid.rows - 1) * gap;
  return { grid, iconSize, gap, padding, gridW, gridH };
}

/** A single icon cell — a mask-tinted box (recolourable) or a native <img>. */
function IconCell({
  url,
  size,
  state,
  recolor,
  background,
}: {
  url: string;
  size: number;
  state: IconState;
  recolor: boolean;
  background: string;
}): React.ReactElement {
  const box: React.CSSProperties = {
    width: size,
    height: size,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: `scale(${state.scale}) rotate(${state.rotate}deg)`,
    opacity: state.opacity,
    willChange: "transform, opacity",
  };
  if (recolor) {
    const mask: React.CSSProperties = {
      width: "100%",
      height: "100%",
      backgroundColor: state.color,
      WebkitMaskImage: `url("${url}")`,
      maskImage: `url("${url}")`,
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      maskPosition: "center",
      WebkitMaskSize: "contain",
      maskSize: "contain",
    };
    return (
      <div style={box}>
        <div style={mask} />
      </div>
    );
  }
  return (
    <div style={{ ...box, background }}>
      <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
    </div>
  );
}

export function Icons({ width, height, background, durationSeconds, files, options }: SceneProps): React.ReactElement {
  const iconSlots = Array.isArray(options.icons) ? (options.icons as string[]) : []; //TODO: replace `as` cast with proper typing
  const urls = useMemo(
    () => iconSlots.map((slot) => files[slot]).filter((u): u is string => Boolean(u)),
    [JSON.stringify(iconSlots), JSON.stringify(files)], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const count = urls.length;

  const bg = typeof options.background === "string" ? options.background : background;
  const recolor = options.recolor !== false;
  const seed = num(options, "seed", 1);
  const steps = Array.isArray(options.steps) ? (options.steps as EffectStep[]) : []; //TODO: replace `as` cast with proper typing
  const base: BaseState = {
    color: typeof options.baseColor === "string" ? options.baseColor : "#f4f4f5",
    scale: typeof options.baseScale === "number" ? options.baseScale : 1,
    opacity: typeof options.baseOpacity === "number" ? options.baseOpacity : 1,
  };

  const layoutKey = `${width}x${height}|${count}|${JSON.stringify(options)}`;
  const layout = useMemo(() => computeLayout(width, height, count, options), [layoutKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const initial = useMemo<IconState[]>(
    () => evalIcons(steps, 0, durationSeconds, layout.grid, base, seed),
    [layoutKey, durationSeconds], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [states, setStates] = useState<IconState[]>(initial);

  // Readiness gate: hold capture until the icons have loaded and the opening state has painted, so
  // the first captured frame is never blank. Created synchronously at first render so the runtime
  // sees it before its own ready check.
  const sceneReady = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!sceneReady.current) {
    let resolve: () => void = () => {};
    const promise = new Promise<void>((r) => (resolve = r));
    sceneReady.current = { promise, resolve };
    window.__sceneReady = promise;
  }
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Wait for the icon images (native <img>) or the mask URLs (fetch) to load, then release the gate.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.all(
        urls.map(
          (u) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              const done = (): void => resolve();
              img.onload = done;
              img.onerror = done;
              img.src = u;
            }),
        ),
      );
      const twoFrames = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await twoFrames();
      if (!cancelled) sceneReady.current?.resolve();
    })();
    return () => {
      cancelled = true;
    };
  }, [layoutKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // The timeline hook: the frame-stepper seeks this; flushSync commits the per-icon states to the DOM
  // before the runtime's trailing rAF + screenshot, so every captured frame shows exactly its state.
  useEffect(() => {
    window.__sceneSeek = (t: number) => {
      flushSync(() => {
        setStates(evalIcons(steps, t, durationSeconds, layout.grid, base, seed));
      });
    };
    return () => {
      delete window.__sceneSeek;
    };
  }, [layoutKey, durationSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const root: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };
  const cols = layout.grid.columns;
  const rows: string[][] = [];
  for (let i = 0; i < urls.length; i += cols) rows.push(urls.slice(i, i + cols));

  const gridStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: layout.gap,
    width: layout.gridW,
    height: layout.gridH,
  };
  const rowStyle: React.CSSProperties = { display: "flex", gap: layout.gap, justifyContent: "center" };

  return (
    <div style={root} ref={rootRef}>
      <div style={gridStyle}>
        {rows.map((rowUrls, r) => (
          <div key={r} style={rowStyle}>
            {rowUrls.map((url, c) => {
              const i = r * cols + c;
              return (
                <IconCell
                  key={i}
                  url={url}
                  size={layout.iconSize}
                  state={states[i] ?? { scale: base.scale ?? 1, color: base.color, opacity: base.opacity ?? 1, rotate: 0 }}
                  recolor={recolor}
                  background={bg}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
