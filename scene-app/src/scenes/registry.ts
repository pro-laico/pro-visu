import type { SceneComponent } from "../types";
import { Phone } from "./Phone";
import { Laptop } from "./Laptop";
import { Browser } from "./Browser";
import { Specimen } from "./Specimen";
import { Wall } from "./Wall";
import { PaletteReel } from "./PaletteReel";

/** Built-in scenes, keyed by the id used in config (`options.scene`). */
export const scenes: Record<string, SceneComponent> = {
  phone: Phone,
  laptop: Laptop,
  browser: Browser,
  specimen: Specimen,
  wall: Wall,
  "palette-reel": PaletteReel,
};
