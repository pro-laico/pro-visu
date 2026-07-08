import type { SceneComponent } from "../types";
import { Icons } from "./Icons";
import { Specimen } from "./Specimen";
import { Wall } from "./Wall";
import { PaletteReel } from "./PaletteReel";

/** Built-in scenes, keyed by the id used in config (`options.scene`). */
export const scenes: Record<string, SceneComponent> = {
  icons: Icons,
  specimen: Specimen,
  wall: Wall,
  "palette-reel": PaletteReel,
};
