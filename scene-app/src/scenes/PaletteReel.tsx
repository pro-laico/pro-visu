import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { SceneProps } from "../types";
import { expansionWeights, type Easing, type ReelTimingParams } from "./palette-reel-timeline";

/**
 * A looping palette reveal: one color is open at a time (the rest are name-only slivers), and the
 * open band crossfades smoothly into the next color — there is never an all-slivers moment, and the
 * clip opens on color 0 fully open. All motion is a deterministic, closed-form function of time
 * (`expansionWeights(t)` → one 0..1 weight per color), published via `window.__sceneSeek(t)` and
 * committed with flushSync, so the frame-stepper renders it frame-exact. Each weight drives a band's
 * flex-grow and the smooth height+opacity reveal of its detail lines — never a CSS transition, which
 * wouldn't survive seeking. The sweep wraps (last color → first), so position(t=D) ≡ position(0): a
 * seamless loop with no mirror.
 *
 * The per-color display strings, swatch hex, and contrast text color are precomputed by the
 * `palette-reel` generator (the scene can't import the color math) and arrive as `options.items`.
 */
interface ReelItem {
  name: string;
  hex: string;
  textColor: string;
  details: string[];
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
/** Hermite smoothstep — eases the detail reveal in/out so values fade & grow rather than popping. */
const smooth = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

export function PaletteReel({
  width,
  height,
  background,
  files,
  options,
}: SceneProps): React.ReactElement {
  const items: ReelItem[] = Array.isArray(options.items) ? (options.items as ReelItem[]) : [];
  const orientation = options.orientation === "columns" ? "columns" : "rows";
  const num = (k: string, d: number): number =>
    typeof options[k] === "number" ? (options[k] as number) : d;
  const bool = (k: string, d: boolean): boolean =>
    typeof options[k] === "boolean" ? (options[k] as boolean) : d;

  // A collapsed sliver has flex-grow 1 (so the slivers split their share evenly); a fully open band
  // grows to `grownFlex` (≈ how many times a sliver's share it takes). Baselining at 1 matters: if
  // the grows summed to < 1 the flexbox would leave the frame underfilled.
  const grownFlex = Math.max(1, num("grownFlex", 12));
  const gap = num("gap", 0);
  const cornerRadius = num("cornerRadius", 0);
  const fontWeight = num("fontWeight", 700);
  const detailFontScale = num("detailFontScale", 0.62);
  const nameAlwaysVisible = bool("nameAlwaysVisible", true);

  const fontUrl = files.font ?? Object.values(files)[0] ?? "";
  const family = fontUrl
    ? `'PaletteReelFont', "Helvetica Neue", Arial, sans-serif`
    : `"Helvetica Neue", Arial, "Segoe UI", system-ui, sans-serif`;

  const nameSize =
    typeof options.fontSize === "number"
      ? options.fontSize
      : Math.round(Math.min(width, height) * 0.045);
  const detailSize = Math.round(nameSize * detailFontScale);
  const detailLinePx = Math.round(detailSize * 1.32); // per detail line incl. line-height
  const minCrossOpt = num("minCrossPx", 0);
  // A legibility floor so a collapsed sliver always has room for its name even while another is open.
  const minCross = minCrossOpt > 0 ? minCrossOpt : Math.round(nameSize * 1.5);
  const padX = Math.round(nameSize * 0.7);
  const padY = Math.round(nameSize * 0.45);

  const count = items.length;
  const optionsKey = `${width}x${height}|${orientation}|${JSON.stringify(options)}`;
  const params = useMemo<ReelTimingParams>(
    () => ({
      count,
      holdSeconds: num("holdSeconds", 2),
      transitionSeconds: num("transitionSeconds", 0.7),
      bounce: bool("bounce", true),
      easing: (typeof options.easing === "string" ? options.easing : "ease-in-out") as Easing,
    }),
    [optionsKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Start on the opening state (color 0 open) so the very first painted frame matches the seek at 0.
  const [weights, setWeights] = useState<number[]>(() => expansionWeights(0, params));

  // Hold capture until the bands have painted (and the font, if any, has loaded). Created once,
  // synchronously at first render, so the runtime sees the gate before its own ready check.
  const sceneReady = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!sceneReady.current) {
    let resolve: () => void = () => {};
    const promise = new Promise<void>((r) => (resolve = r));
    sceneReady.current = { promise, resolve };
    window.__sceneReady = promise;
  }

  useEffect(() => {
    // The timeline hook: the frame-stepper seeks this; flushSync commits the sizing/opacity to the
    // DOM before the runtime's trailing rAF + screenshot, so every frame shows exactly its time.
    window.__sceneSeek = (t: number) => {
      flushSync(() => setWeights(expansionWeights(t, params)));
    };
    const markPainted = (): void => {
      requestAnimationFrame(() => requestAnimationFrame(() => sceneReady.current?.resolve()));
    };
    // Gate on font readiness only when a custom font is served (else the first frame could use the
    // fallback font); otherwise resolve after a committed paint.
    void (fontUrl ? (document.fonts?.ready ?? Promise.resolve()) : Promise.resolve()).then(
      markPainted,
    );
    return () => {
      delete window.__sceneSeek;
    };
  }, [optionsKey, params, fontUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const root: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    background,
    fontFamily: family,
    letterSpacing: "-0.01em",
  };
  const wrap: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: orientation === "rows" ? "column" : "row",
    gap,
  };

  // Detail lines in a wrapper whose height grows from 0 with the reveal — so they expand & fade in
  // smoothly and never occupy space (nor shift the name) while the band is a sliver.
  const details = (item: ReelItem, reveal: number): React.ReactElement | null => {
    if (!item.details.length) return null;
    return (
      <div
        style={{
          overflow: "hidden",
          maxHeight: Math.round(item.details.length * detailLinePx * reveal),
          marginTop: Math.round(detailSize * 0.32 * reveal),
          opacity: reveal,
        }}
      >
        {item.details.map((d, j) => (
          <div
            key={j}
            style={{ fontSize: detailSize, fontWeight, lineHeight: 1.32, whiteSpace: "nowrap" }}
          >
            {d}
          </div>
        ))}
      </div>
    );
  };

  const renderBandContent = (item: ReelItem, w: number): React.ReactElement => {
    const reveal = smooth((w - 0.12) / 0.72); // details grow/fade in once the band has real size
    const block: React.CSSProperties = {
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "flex-start",
      padding: `${padY}px ${padX}px`,
    };
    const nameLine = (opacity: number): React.ReactElement => (
      <div style={{ fontSize: nameSize, fontWeight, lineHeight: 1.08, whiteSpace: "nowrap", opacity }}>
        {item.name}
      </div>
    );

    if (orientation === "rows") {
      const nameOp = nameAlwaysVisible ? 1 : smooth(w / 0.45);
      return (
        <div style={block}>
          {nameLine(nameOp)}
          {details(item, reveal)}
        </div>
      );
    }

    // columns: crossfade a vertical collapsed label out as the upright name+details block fades in.
    const nameReveal = smooth(w / 0.45);
    return (
      <>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 1 - nameReveal,
          }}
        >
          <div style={{ writingMode: "vertical-rl", fontSize: nameSize, fontWeight, whiteSpace: "nowrap" }}>
            {item.name}
          </div>
        </div>
        <div style={{ ...block, opacity: nameReveal }}>
          {nameLine(1)}
          {details(item, reveal)}
        </div>
      </>
    );
  };

  return (
    <div style={root}>
      <div style={wrap}>
        {items.map((item, i) => {
          const w = weights[i] ?? 0;
          const grow = 1 + w * (grownFlex - 1);
          const band: React.CSSProperties = {
            position: "relative",
            flexGrow: grow,
            flexShrink: 1,
            flexBasis: 0,
            [orientation === "rows" ? "minHeight" : "minWidth"]: minCross,
            background: item.hex,
            color: item.textColor,
            borderRadius: cornerRadius,
            overflow: "hidden",
            willChange: "flex-grow",
          };
          return (
            <div key={i} style={band}>
              {renderBandContent(item, w)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
