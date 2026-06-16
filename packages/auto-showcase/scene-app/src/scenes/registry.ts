import type { SceneComponent } from "../types";
import { Specimen } from "./Specimen";
import { Wall } from "./Wall";
import { PaletteReel } from "./PaletteReel";

/** Built-in scenes, keyed by the id used in config (`options.scene`). */
export const scenes: Record<string, SceneComponent> = {
  specimen: Specimen,
  wall: Wall,
  "palette-reel": PaletteReel,
};
