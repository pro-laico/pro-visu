// Public API consumed by `showcase.config.ts`.
export { defineConfig } from "@/config/define-config";
export type {
  ShowcaseUserConfig,
  ShowcaseSettingsInput,
  BrowserSettingsInput,
  ServerSettingsInput,
  AssetSpecInput,
  LogLevel,
} from "@/config/define-config";
export type { ScrollReelOptions } from "@/generators/scroll-reel/options";
export type { ScreenshotsOptions } from "@/generators/screenshots/options";
export type { DeviceFrameOptions } from "@/generators/device-frame/options";
