import { z } from "zod";

/**
 * A "scene" composites input assets inside a web page (a React component shipped with the
 * tool, selected by `scene`) and captures the rendered result. Inputs come from the asset's
 * `inputs` map; per-scene knobs go in `sceneOptions`.
 */
export const sceneOptionsSchema = z
  .object({
    /** Built-in scene id (e.g. "phone"). */
    scene: z.string().default("phone"),
    /** Output frame size (CSS px). */
    width: z.number().int().positive().default(1080),
    height: z.number().int().positive().default(1080),
    /** Backdrop behind the scene. */
    background: z.string().default("#0b0b0f"),
    /** Render scale (2 = retina-crisp). */
    deviceScaleFactor: z.number().positive().max(4).default(2),
    fps: z.number().int().positive().max(120).default(30),
    /** Capture length (seconds). */
    durationSeconds: z.number().positive().default(6),
    /** Capture strategy. "realtime" records live; "frames" steps deterministically. */
    capture: z.enum(["realtime", "frames"]).default("realtime"),
    /** Parallel frame-render workers (frames capture only). Omit to auto-pick from cores. */
    workers: z.number().int().positive().optional(),
    /**
     * Intermediate frame format (frames capture only). "jpeg" (default) is fast and high quality;
     * "png" is lossless into the encoder — maximum fidelity, slower screenshots.
     */
    frameFormat: z.enum(["jpeg", "png"]).default("jpeg"),
    /** x264 quality, 0–51 (lower = better/larger). */
    crf: z.number().int().min(0).max(51).default(18),
    /** Output filename; defaults to "<slug(asset name)>.mp4". */
    fileName: z.string().optional(),
    /**
     * Static files to serve into the scene, as `{ name: path }` (paths relative to the cwd,
     * or absolute). Their URLs are exposed to the scene as `files.<name>` — e.g. a font.
     */
    files: z.record(z.string(), z.string()).default({}),
    /** Arbitrary knobs forwarded to the scene component. */
    sceneOptions: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type SceneOptions = z.input<typeof sceneOptionsSchema>;
export type ResolvedSceneOptions = z.infer<typeof sceneOptionsSchema>;
