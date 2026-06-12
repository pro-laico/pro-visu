import { createRoot } from "react-dom/client";
import { scenes } from "./scenes/registry";
import { initRuntime } from "./runtime";
import type { SceneProps } from "./types";

const FALLBACK: SceneProps = {
  width: 1080,
  height: 1080,
  background: "#0b0b0f",
  durationSeconds: 6,
  fps: 30,
  inputs: {},
  options: {},
};

function readConfig(): { scene: string; props: SceneProps } {
  const q = new URLSearchParams(window.location.search);
  const scene = q.get("scene") ?? "phone";
  const raw = q.get("props");
  const props = raw ? ({ ...FALLBACK, ...JSON.parse(raw) } as SceneProps) : FALLBACK;
  return { scene, props };
}

const { scene, props } = readConfig();
const rootEl = document.getElementById("root");

if (rootEl) {
  const Scene = scenes[scene];
  if (!Scene) {
    rootEl.textContent = `Unknown scene "${scene}"`;
  } else {
    document.body.style.background = props.background;
    createRoot(rootEl).render(
      <div
        style={{
          width: props.width,
          height: props.height,
          background: props.background,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Scene {...props} />
      </div>,
    );
    // Publish the capture runtime once the scene (and its <video>s) have mounted.
    requestAnimationFrame(() => initRuntime());
  }
}
