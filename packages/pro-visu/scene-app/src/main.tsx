import { createRoot } from "react-dom/client";

import { initRuntime } from "./runtime";
import type { SceneProps } from "./types";
import { scenes } from "./scenes/registry";

import "virtual:uno.css";

const FALLBACK: SceneProps = {
  width: 1080,
  height: 1080,
  background: "#0b0b0f",
  durationSeconds: 6,
  fps: 30,
  inputs: {},
  files: {},
  options: {},
};

function readConfig(): { scene: string; props: SceneProps } {
  const q = new URLSearchParams(window.location.search);
  const scene = q.get("scene") ?? "wall";
  const raw = q.get("props");
  let parsed: Partial<SceneProps> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Partial<SceneProps>; //TODO: replace `as` cast with proper typing
    } catch {
      parsed = {};
    }
  }
  return { scene, props: { ...FALLBACK, ...parsed } };
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
      <div style={{ width: props.width, height: props.height, background: props.background, overflow: "hidden", position: "relative" }}>
        <Scene {...props} />
      </div>,
    );
    requestAnimationFrame(() => initRuntime());
  }
}
