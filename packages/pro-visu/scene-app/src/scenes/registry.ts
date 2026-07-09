import { Wall } from "./Wall";
import { Icons } from "./Icons";
import { Specimen } from "./Specimen";
import { PaletteReel } from "./PaletteReel";
import type { SceneComponent } from "../types";

/** Built-in scenes, keyed by the id used in config (`options.scene`). */
export const scenes: Record<string, SceneComponent> = {
  icons: Icons,
  specimen: Specimen,
  wall: Wall,
  "palette-reel": PaletteReel,
};
