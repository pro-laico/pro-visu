# The scene engine

`wall`, `specimen`, and `palette-reel` are not bespoke renderers — they are **scenes**: React
components rendered by the bundled Vite app in `scene-app/`, captured deterministically by this
directory, and exposed to authors through a thin per-generator options layer. This is the seam to
use when adding a new looping-video generator.

## How a scene renders

1. A generator (e.g. `generators/wall`) maps its friendly, author-facing options onto the wire
   format in `options.ts` (`ResolvedSceneOptions`) and calls `renderScene()` (`render.ts`).
2. `renderScene` validates the per-scene knobs against that scene's schema in `scene-options.ts`
   (a typo'd key or unknown scene id fails fast with a named error), then serves the built scene
   app + any input assets/files over a local server (`serve.ts`).
3. The scene component (in `scene-app/src/scenes/`) renders from props decoded off the URL. It
   publishes `window.__sceneSeek(t)` — all motion must be a **pure function of time** — and may
   gate capture on `window.__sceneReady` (a promise) until its media has loaded and measured.
4. Capture is frame-stepped (`capture-frames.ts`: seek → screenshot per frame, parallel workers,
   piped to ffmpeg — deterministic, byte-identical) or realtime (`capture-realtime.ts`: record the
   live session once — handy while iterating).

## Adding a scene

1. **Component** — `scene-app/src/scenes/YourScene.tsx`, registered in
   `scene-app/src/scenes/registry.ts`. Implement `__sceneSeek(t)` as a pure function of time
   (use `flushSync` so the frame is committed before the screenshot) and resolve
   `window.__sceneReady` once layout is stable.
2. **Wire schema** — add `yourSceneOptionsSchema` to `scene-options.ts` and register it in
   `SCENE_OPTION_SCHEMAS`. Every default should match what the component would render unstyled.
3. **Generator** — `src/generators/your-scene/` with the friendly authoring surface (options.ts
   with zod schema + documented input interface + `Exact<>` guard) that maps onto
   `ResolvedSceneOptions` and calls `renderScene(ctx, sceneOptions, YOUR_ID)`. Register it in
   `generators/registry.ts` and extend `AssetSpecInput` + `defaults` in `config/define-config.ts`.
4. **Docs** — a page under `apps/docs/content/docs/generators/` + the nav entry in `meta.json`.

Seamless looping is a property of the motion math, not the encoder: make travel over the clip an
integer number of periods (see `scene-app/src/scenes/wall-motion.ts` for the pattern and its
unit tests).
