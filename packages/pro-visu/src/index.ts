// Public API consumed by `pro-visu.config.ts` and any modules a config is split into.
// Every author-facing type is exported so a config can be composed from many files
// (settings in one, each asset family in its own, joined with `satisfies`).

export { defineConfig } from "@/config/define-config";
export type {
  ShowcaseUserConfig,
  ShowcaseSettingsInput,
  BrowserSettingsInput,
  ServerSettingsInput,
  CaptureSettingsInput,
  AssetSpecInput,
  AssetBaseInput,
  LogLevel,
} from "@/config/define-config";

// shared across generators
export type { Easing } from "@/generators/easing";
export type { ViewportInput } from "@/generators/shared-options";

// scroll-reel
export type {
  ScrollReelOptions,
  ChoreographyStepInput,
  AutoSectionsInput,
  AspectInput,
} from "@/generators/scroll-reel/options";

// interaction
export type {
  InteractionOptions,
  InteractionActionInput,
  CursorInput,
  FocusInput,
} from "@/generators/interaction/options";

// screenshots
export type { ScreenshotsOptions, ElementShotInput } from "@/generators/screenshots/options";

// wall
export type {
  WallOptions,
  WallColumnInput,
  WallTileInput,
  WallPanInput,
  WallPulseInput,
  FauxTileInput,
} from "@/generators/wall/options";

// specimen
export type {
  SpecimenOptions,
  PulseInput,
  SpecimenColorsInput,
  SpecimenColorWeightsInput,
  SpecimenLabelInput,
  SpecimenLabelAnchor,
  SpecimenTemplate,
} from "@/generators/specimen/options";

// palette + palette-reel
export type { PaletteOptions, PaletteColorInput } from "@/generators/palette/options";
export type { FieldId as PaletteFieldId } from "@/generators/palette/color";
export type { PaletteReelOptions } from "@/generators/palette-reel/options";
