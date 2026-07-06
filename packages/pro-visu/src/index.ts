// Public API consumed by `pro-visu.config.ts` and any modules a config is split into.
// Every author-facing type is exported so a config can be composed from many files
// (settings in one, each asset family in its own) instead of one monolithic file.

export { defineConfig, defineSettings, defineAsset, defineAssets } from "@/config/define-config";
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

// scroll-reel
export type {
  ScrollReelOptions,
  ChoreographyStepInput,
  InteractionActionInput,
  AutoSectionsInput,
  CardInput,
  AnnotationInput,
  KenBurnsInput,
  CursorInput,
  FocusInput,
  ViewportInput as ScrollReelViewportInput,
  RouteInput,
  AspectInput,
  Easing,
} from "@/generators/scroll-reel/options";

// screenshots
export type {
  ScreenshotsOptions,
  ViewportInput as ScreenshotViewportInput,
  ElementShotInput,
} from "@/generators/screenshots/options";

// wall
export type {
  WallOptions,
  WallColumnInput,
  WallPanInput,
  WallPulseInput,
  WallEasing,
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

// image
export type { ImageOptions } from "@/generators/image/options";
