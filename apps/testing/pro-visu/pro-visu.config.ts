import { defineConfig } from "pro-visu";

import { films } from "../showcase/films";
import { wallAssets } from "../showcase/wall";
import { focusClips } from "../showcase/focus";
import { settings } from "../showcase/settings";
import { screenshots } from "../showcase/screenshots";
import { brandAssets } from "../showcase/brand-assets";
import { interactions } from "../showcase/interactions";

export default defineConfig({
  settings,
  assets: [...wallAssets, ...films, ...focusClips, ...interactions, ...screenshots, ...brandAssets],
});
