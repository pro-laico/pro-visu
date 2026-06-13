import type { ScrollReelOptions } from "@/generators/scroll-reel/options";
import type { ScreenshotsOptions } from "@/generators/screenshots/options";
import type { DeviceFrameOptions } from "@/generators/device-frame/options";
import type { SceneOptions } from "@/generators/scene/options";
import type { SpecimenOptions } from "@/generators/specimen/options";
import type { PaletteOptions } from "@/generators/palette/options";

/**
 * Author-facing config types. These power editor autocomplete in `showcase.config.ts`.
 * The runtime validator lives in `schema.ts`; each generator validates its own options.
 * When a new generator is added, extend `AssetSpecInput` and `defaults` here.
 */

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

export interface BrowserSettingsInput {
  /** Run the browser without a visible window (default true). Set false to watch captures. */
  headless?: boolean;
  /** Browser channel, e.g. "chrome" or "msedge". Omit to use the managed Chromium. */
  channel?: string;
  /** Absolute path to a browser executable (overrides `channel` + managed Chromium). */
  executablePath?: string;
  /** Extra launch args, e.g. ["--no-sandbox"] on CI. */
  args?: string[];
  /** Browser launch timeout (ms). */
  timeout?: number;
}

export interface ServerSettingsInput {
  /** Command that starts the server, run via the shell, e.g. "next start -p 3101". */
  command: string;
  /** Optional one-shot build to run first, e.g. "next build". */
  build?: string;
  /** Health-check URL polled until it responds. Defaults to http://127.0.0.1:<port>. */
  url?: string;
  /**
   * Port the readiness check polls — also derives `url` when `url` is omitted. Defaults to 3101.
   * Note: this is only where the tool probes; your `command` must actually bind this port.
   */
  port?: number;
  /** Working dir for build + command, relative to the config dir. Defaults to it. */
  cwd?: string;
  /** Max time to wait for the server to become reachable (ms). Default 120000. */
  readyTimeoutMs?: number;
  /** If a server is already reachable at the URL, use it as-is (don't start/stop one). */
  reuseExisting?: boolean;
}

export interface ShowcaseSettingsInput {
  /** Output directory for generated assets, relative to the repo root (default "showcase"). */
  outDir?: string;
  /** How many assets to generate in parallel (shared browser, separate contexts). */
  concurrency?: number;
  /** CLI log verbosity. */
  logLevel?: LogLevel;
  /** Playwright launch controls. */
  browser?: BrowserSettingsInput;
  /** Build → start → wait → capture → stop a server automatically. */
  server?: ServerSettingsInput;
  /** "draft" lowers fps/scale and speeds the encoder for fast iteration. */
  quality?: "draft" | "final";
  /** Skip assets whose inputs+options+tool fingerprint is unchanged (opt-in). */
  cache?: boolean;
  /** Per-generator option defaults, keyed by generator id, merged under each asset. */
  defaults?: {
    "scroll-reel"?: ScrollReelOptions;
    screenshots?: ScreenshotsOptions;
    "device-frame"?: DeviceFrameOptions;
    specimen?: SpecimenOptions;
    palette?: PaletteOptions;
  };
}

/** Fields common to every asset. */
export interface AssetBaseInput {
  /** Unique id for this asset — also the output filename (`<slug(name)>.mp4`) and manifest key. */
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
  | (AssetBaseInput & { url?: string; generator: "scene"; options?: SceneOptions })
  | (AssetBaseInput & { generator: "specimen"; options: SpecimenOptions })
  | (AssetBaseInput & { generator: "palette"; options: PaletteOptions });

export interface ShowcaseUserConfig {
  settings?: ShowcaseSettingsInput;
  assets: AssetSpecInput[];
}

/** Identity helper that gives `showcase.config.ts` full type-checking + autocomplete. */
export function defineConfig(config: ShowcaseUserConfig): ShowcaseUserConfig {
  return config;
}
