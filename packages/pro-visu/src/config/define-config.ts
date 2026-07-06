import type { ScrollReelOptions } from "@/generators/scroll-reel/options";
import type { ScreenshotsOptions } from "@/generators/screenshots/options";
import type { WallOptions } from "@/generators/wall/options";
import type { SpecimenOptions } from "@/generators/specimen/options";
import type { PaletteOptions } from "@/generators/palette/options";
import type { PaletteReelOptions } from "@/generators/palette-reel/options";
import type { ImageOptions } from "@/generators/image/options";

/**
 * Author-facing config types. These power editor autocomplete in `pro-visu.config.ts`.
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
  /**
   * Command that starts the server, run via the shell. The tool sets PORT/HOST in its environment
   * to the readiness port/host, so frameworks that honor PORT (Next, Vite, …) bind it
   * automatically — `command: "next start"` is enough. An explicit flag still wins.
   */
  command: string;
  /** Optional one-shot build to run first, e.g. "next build". */
  build?: string;
  /** Health-check URL polled until it responds. Defaults to http://127.0.0.1:<port>. */
  url?: string;
  /**
   * Port the readiness check polls — also derives `url` when `url` is omitted, and is passed to
   * the command as PORT so it binds the same port automatically. Defaults to 3101.
   */
  port?: number;
  /** Working dir for build + command, relative to the config dir. Defaults to it. */
  cwd?: string;
  /** Max time to wait for the server to become reachable (ms). Default 120000. */
  readyTimeoutMs?: number;
  /** If a server is already reachable at the URL, use it as-is (don't start/stop one). */
  reuseExisting?: boolean;
}

export interface CaptureSettingsInput {
  /** Query params appended to every URL-based asset, e.g. `{ capture: "1" }` → `?capture=1`. */
  query?: Record<string, string>;
  /** Cookies set on every capture context before navigation (scoped to the asset's origin). */
  cookies?: { name: string; value: string }[];
  /** localStorage entries seeded (per origin) before the page's own scripts run. */
  localStorage?: Record<string, string>;
  /** JS run in every page before its own scripts, e.g. `window.__PV_CAPTURE__ = true`. */
  initScript?: string;
}

export interface ShowcaseSettingsInput {
  /** Output directory for generated assets, relative to the repo root (default "pro-visu"). */
  outDir?: string;
  /** How many assets to generate in parallel (shared browser, separate contexts). */
  concurrency?: number;
  /**
   * Raise the Node heap (V8 old-space) to this many MB. Heavy jobs — large frame-stepped walls
   * especially — can exceed Node's ~4 GB default and crash with "JavaScript heap out of memory".
   * When set above the current limit, the CLI re-execs itself with `--max-old-space-size`. This is
   * the Node process heap, not the browser's.
   */
  maxMemoryMB?: number;
  /** CLI log verbosity. */
  logLevel?: LogLevel;
  /** Playwright launch controls. */
  browser?: BrowserSettingsInput;
  /** Build → start → wait → capture → stop a server automatically. */
  server?: ServerSettingsInput;
  /** Capture-mode toggles applied to every URL-based asset (disable animations, hide cookie banner, …). */
  capture?: CaptureSettingsInput;
  /** "draft" lowers fps/scale and speeds the encoder for fast iteration. */
  quality?: "draft" | "final";
  /** Skip assets whose inputs+options+tool fingerprint is unchanged (opt-in). */
  cache?: boolean;
  /** Per-generator option defaults, keyed by generator id, merged under each asset. */
  defaults?: {
    "scroll-reel"?: ScrollReelOptions;
    screenshots?: ScreenshotsOptions;
    wall?: WallOptions;
    specimen?: SpecimenOptions;
    palette?: PaletteOptions;
    "palette-reel"?: PaletteReelOptions;
    image?: ImageOptions;
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
 * generators take a `url` — absolute, or a `/path` resolved against the managed server; omit it
 * to capture the managed server's root. Local generators (wall, specimen, palette, image) need none.
 */
export type AssetSpecInput =
  | (AssetBaseInput & { url?: string; generator: "scroll-reel"; options?: ScrollReelOptions })
  | (AssetBaseInput & { url?: string; generator: "screenshots"; options?: ScreenshotsOptions })
  | (AssetBaseInput & { generator: "wall"; options?: WallOptions })
  | (AssetBaseInput & { generator: "specimen"; options: SpecimenOptions })
  | (AssetBaseInput & { generator: "palette"; options: PaletteOptions })
  | (AssetBaseInput & { generator: "palette-reel"; options: PaletteReelOptions })
  | (AssetBaseInput & { generator: "image"; options: ImageOptions });

export interface ShowcaseUserConfig {
  settings?: ShowcaseSettingsInput;
  assets: AssetSpecInput[];
}

/** Identity helper that gives `pro-visu.config.ts` full type-checking + autocomplete. */
export function defineConfig(config: ShowcaseUserConfig): ShowcaseUserConfig {
  return config;
}

/** Identity helper for a `settings` block kept in its own module. */
export function defineSettings(settings: ShowcaseSettingsInput): ShowcaseSettingsInput {
  return settings;
}

/** Identity helper for a single asset kept in its own module. */
export function defineAsset(asset: AssetSpecInput): AssetSpecInput {
  return asset;
}

/** Identity helper for a group of assets kept in their own module. */
export function defineAssets(assets: AssetSpecInput[]): AssetSpecInput[] {
  return assets;
}
