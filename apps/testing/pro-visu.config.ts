import { defineConfig } from "pro-visu";
import { brandAssets } from "./showcase/brand-assets";
import { films } from "./showcase/films";
import { focusClips } from "./showcase/focus";
import { interactions } from "./showcase/interactions";
import { screenshots } from "./showcase/screenshots";
import { settings } from "./showcase/settings";
import { tour } from "./showcase/tour";
import { wallAssets } from "./showcase/wall";

// The complete VESPER showcase, split into modules under showcase/ (one file per asset family).
// Render everything with `pnpm generate`, or a subset with `pnpm generate --asset <name>`
// (repeatable — dependencies are pulled in automatically).
export default defineConfig({
  settings,
  assets: [...wallAssets, ...films, ...focusClips, ...interactions, ...tour, ...screenshots, ...brandAssets],
});
