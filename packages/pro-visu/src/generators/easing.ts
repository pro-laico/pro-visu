import { z } from "zod";

/**
 * The ONE easing vocabulary, shared by every generator that eases motion (scroll-reel travel,
 * wall pulses/pan, palette-reel crossfades). Six names: the CSS-familiar four plus two "strong"
 * variants with a heavier hold at the ends. The scene app implements the same curves by name.
 */
export const easingSchema = z.enum(["linear", "ease-in", "ease-out", "ease-in-out", "ease-out-strong", "ease-in-out-strong"]);
export type Easing = z.infer<typeof easingSchema>;

/** Pure easing functions, t in [0,1] → [0,1]. The base curves are cubic; "strong" is quintic. */
export const EASINGS: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": (t) => t * t * t,
  "ease-out": (t) => 1 - Math.pow(1 - t, 3),
  "ease-in-out": (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  "ease-out-strong": (t) => 1 - Math.pow(1 - t, 5),
  "ease-in-out-strong": (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
};

/**
 * Pre-unification easing names → their canonical replacement. Surfaced as migration hints when a
 * config still uses the old scroll-reel curve names.
 */
export const RENAMED_EASINGS: Record<string, Easing> = {
  "ease-in-out-cubic": "ease-in-out",
  "ease-in-out-quad": "ease-in-out",
  "ease-in-out-sine": "ease-in-out",
  "ease-out-cubic": "ease-out",
  "ease-in-out-expo": "ease-in-out-strong",
  "ease-out-quint": "ease-out-strong",
};
