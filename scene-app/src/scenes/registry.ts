import type { SceneComponent } from "../types";
import { Phone } from "./Phone";
import { Laptop } from "./Laptop";
import { Browser } from "./Browser";
import { Specimen } from "./Specimen";

/** Built-in scenes, keyed by the id used in config (`options.scene`). */
export const scenes: Record<string, SceneComponent> = {
  phone: Phone,
  laptop: Laptop,
  browser: Browser,
  specimen: Specimen,
};
