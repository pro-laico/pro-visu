export interface Annotation {
  /** Caption text shown while active. */
  text?: string;
  /** Selector to outline with a highlight ring while active. */
  ring?: string;
  /** Selector to spotlight (everything else dimmed) while active. */
  spotlight?: string;
  /** When the annotation appears (clip time, ms). Default 0. */
  atMs?: number;
  /** When it disappears (clip time, ms). Default = end of clip. */
  untilMs?: number;
  /** Caption placement. Default "bottom". */
  position?: "top" | "bottom" | "center";
}

export interface AnnotationState {
  caption?: { text: string; position: "top" | "bottom" | "center" };
  ringSelector?: string;
  spotlightSelector?: string;
}

/**
 * Pure: resolve the overlay state at clip-time `tMs`. The first active annotation of each kind
 * (caption / ring / spotlight) wins, so independent annotations can overlap. Unit-tested.
 */
export function annotationStateAt(
  annotations: Annotation[],
  tMs: number,
  totalMs: number,
): AnnotationState {
  const state: AnnotationState = {};
  for (const a of annotations) {
    const start = a.atMs ?? 0;
    const end = a.untilMs ?? totalMs;
    if (tMs < start || tMs >= end) continue;
    if (a.text && !state.caption) state.caption = { text: a.text, position: a.position ?? "bottom" };
    if (a.ring && !state.ringSelector) state.ringSelector = a.ring;
    if (a.spotlight && !state.spotlightSelector) state.spotlightSelector = a.spotlight;
  }
  return state;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Runs INSIDE the page. Builds the annotation overlay (caption box, highlight ring, spotlight dim) and
 * exposes `window.__scAnno.update(state)` to reposition it per frame. The layer is attached to <html>
 * (not <body>) so a Ken Burns body transform doesn't move it; element boxes are read via
 * getBoundingClientRect, which already reflects any transform. Self-contained (serialized into the page).
 */
export function installAnnotationRuntime(opts: { color: string }): void {
  const g = globalThis as any;
  const doc = g.document;
  if (!doc || !doc.documentElement) return;

  const layer = doc.createElement("div");
  layer.style.cssText = "position:fixed;inset:0;margin:0;pointer-events:none;z-index:2147483646";

  const spot = doc.createElement("div");
  spot.style.cssText =
    "position:fixed;display:none;border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,0.62)";

  const ring = doc.createElement("div");
  ring.style.cssText =
    "position:fixed;display:none;border:3px solid " +
    opts.color +
    ";border-radius:12px;box-shadow:0 0 0 3px rgba(255,255,255,0.45)";

  const cap = doc.createElement("div");
  cap.style.cssText =
    "position:fixed;left:50%;display:none;max-width:80%;background:rgba(11,11,15,0.85);color:#fff;" +
    "font:600 28px -apple-system,Segoe UI,Roboto,sans-serif;padding:14px 22px;border-radius:12px;text-align:center";

  layer.appendChild(spot);
  layer.appendChild(ring);
  layer.appendChild(cap);
  doc.documentElement.appendChild(layer);

  const boxOf = (sel: string): { x: number; y: number; w: number; h: number } | null => {
    try {
      const el = doc.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    } catch {
      return null;
    }
  };
  const place = (el: any, b: { x: number; y: number; w: number; h: number }, pad: number): void => {
    el.style.display = "block";
    el.style.left = b.x - pad + "px";
    el.style.top = b.y - pad + "px";
    el.style.width = b.w + 2 * pad + "px";
    el.style.height = b.h + 2 * pad + "px";
  };

  g.__scAnno = {
    update: (state: any): Promise<void> =>
      new Promise((resolve) => {
        const sb = state.spotlightSelector ? boxOf(state.spotlightSelector) : null;
        if (sb) place(spot, sb, 8);
        else spot.style.display = "none";

        const rb = state.ringSelector ? boxOf(state.ringSelector) : null;
        if (rb) place(ring, rb, 6);
        else ring.style.display = "none";

        if (state.caption && state.caption.text) {
          cap.style.display = "block";
          cap.textContent = state.caption.text;
          const pos = state.caption.position;
          if (pos === "top") {
            cap.style.top = "6%";
            cap.style.bottom = "auto";
            cap.style.transform = "translateX(-50%)";
          } else if (pos === "center") {
            cap.style.top = "50%";
            cap.style.bottom = "auto";
            cap.style.transform = "translate(-50%,-50%)";
          } else {
            cap.style.bottom = "6%";
            cap.style.top = "auto";
            cap.style.transform = "translateX(-50%)";
          }
        } else {
          cap.style.display = "none";
        }
        g.requestAnimationFrame(() => resolve());
      }),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
