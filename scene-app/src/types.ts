import type { ReactElement } from "react";

/** Props passed to every scene, decoded from the page URL by the host. */
export interface SceneProps {
  /** Output frame size (CSS px). */
  width: number;
  height: number;
  /** Backdrop behind the scene. */
  background: string;
  /** Intended capture length (seconds). */
  durationSeconds: number;
  fps: number;
  /** Input asset URLs, keyed by slot name (e.g. { screen: "/_inputs/screen.mp4" }). */
  inputs: Record<string, string>;
  /** Served static-file URLs (e.g. fonts), keyed by name (`options.files`). */
  files: Record<string, string>;
  /** Scene-specific knobs forwarded from config (`options.sceneOptions`). */
  options: Record<string, unknown>;
}

export type SceneComponent = (props: SceneProps) => ReactElement;
