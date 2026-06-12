import type { ScrollReelOptions } from "@/generators/scroll-reel/options";
import type { ScreenshotsOptions } from "@/generators/screenshots/options";
import type { DeviceFrameOptions } from "@/generators/device-frame/options";
import type { SceneOptions } from "@/generators/scene/options";

/**
 * Author-facing config types. These power editor autocomplete in `showcase.config.ts`.
 * The runtime validator lives in `schema.ts`; each generator validates its own options.
 * When a new generator is added, extend `AssetSpecInput` and `defaults` here.
 */

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

export interface BrowserSettingsInput {
  headless?: boolean;
  channel?: string;
  executablePath?: string;
  args?: string[];
  timeout?: number;
}

export interface ServerSettingsInput {
  /** Command that starts the server, run via the shell, e.g. "next start -p 3000". */
  command: string;
  /** Optional one-shot build to run first, e.g. "next build". */
  build?: string;
  /** Health-check URL polled until it responds. Defaults to http://127.0.0.1:<port>. */
  url?: string;
  /** Port — used to derive `url` when `url` is omitted. One of `url`/`port` is required. */
  port?: number;
  /** Working dir for build + command, relative to the config dir. Defaults to it. */
  cwd?: string;
  /** Max time to wait for the server to become reachable (ms). Default 120000. */
  readyTimeoutMs?: number;
  /** If a server is already reachable at the URL, use it as-is (don't start/stop one). */
  reuseExisting?: boolean;
}

export interface ShowcaseSettingsInput {
  outDir?: string;
  concurrency?: number;
  logLevel?: LogLevel;
  browser?: BrowserSettingsInput;
  /** Build → start → wait → capture → stop a server automatically. */
  server?: ServerSettingsInput;
  /** Per-generator option defaults, keyed by generator id, merged under each asset. */
  defaults?: {
    "scroll-reel"?: ScrollReelOptions;
    screenshots?: ScreenshotsOptions;
    "device-frame"?: DeviceFrameOptions;
  };
}

/** Fields common to every asset. */
export interface AssetBaseInput {
  name: string;
  /** Other assets this one consumes, as `{ slotName: assetName }`. Producers run first. */
  inputs?: Record<string, string>;
}

/**
 * Discriminated by `generator` so each asset gets the right `options` autocomplete. URL-based
 * generators require `url`; a local `scene` composites its `inputs` and needs none.
 */
export type AssetSpecInput =
  | (AssetBaseInput & { url: string; generator: "scroll-reel"; options?: ScrollReelOptions })
  | (AssetBaseInput & { url: string; generator: "screenshots"; options?: ScreenshotsOptions })
  | (AssetBaseInput & { url: string; generator: "device-frame"; options?: DeviceFrameOptions })
  | (AssetBaseInput & { url?: string; generator: "scene"; options?: SceneOptions });

export interface ShowcaseUserConfig {
  settings?: ShowcaseSettingsInput;
  assets: AssetSpecInput[];
}

/** Identity helper that gives `showcase.config.ts` full type-checking + autocomplete. */
export function defineConfig(config: ShowcaseUserConfig): ShowcaseUserConfig {
  return config;
}
