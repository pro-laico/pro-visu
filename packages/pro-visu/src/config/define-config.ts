import type { ScrollReelOptions } from "@/generators/scroll-reel/options";
import type { InteractionOptions } from "@/generators/interaction/options";
import type { ScreenshotsOptions } from "@/generators/screenshots/options";
import type { WallOptions } from "@/generators/wall/options";
import type { SpecimenOptions } from "@/generators/specimen/options";
import type { IconsOptions } from "@/generators/icons/options";
import type { PaletteOptions } from "@/generators/palette/options";
import type { PaletteReelOptions } from "@/generators/palette-reel/options";

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
  /** Browser launch timeout (ms). Default 30000. */
  launchTimeoutMs?: number;
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

/**
 * Signals INTO the site — a "capture mode" flag delivered four ways. The site must READ one and
 * render capture-friendly (reveals settled, count-ups final). A cookie can also carry auth.
 */
export interface CaptureSignalsInput {
  /** Query params appended to every URL-based asset, e.g. `{ capture: "1" }` → `?capture=1`. */
  query?: Record<string, string>;
  /** Cookies set on every capture context before navigation (scoped to the asset's origin). */
  cookies?: { name: string; value: string }[];
  /** localStorage entries seeded (per origin) before the page's own scripts run. */
  localStorage?: Record<string, string>;
  /** JS run in every page before its own scripts, e.g. `window.__PV_CAPTURE__ = true`. */
  initScript?: string;
}

/** Cleanup applied BY the tool — needs no site cooperation. */
export interface CaptureCleanupInput {
  /** Hide elements matching these CSS selectors before capture (cookie banners, chat widgets, …). Default none. */
  hideSelectors?: string[];
  /** Extra CSS injected before capture (e.g. a brand backdrop, or hiding a sticky header). Omit for none. */
  injectCss?: string;
  /** Click these selectors once after load to dismiss overlays (consent dialogs); best-effort. Default none. */
  clickSelectors?: string[];
  /** Hide scrollbars so they don't appear in captures. Default true. */
  hideScrollbars?: boolean;
  /** Pause CSS animations/transitions for fully static, deterministic captures. Default false. */
  pauseAnimations?: boolean;
  /** Freeze Date.now / performance.now / Math.random (seeded) so time/random content is stable. Default false. */
  freezeClock?: boolean;
  /** Abort common analytics/ads/session-replay requests during capture (cleaner, faster). Default true. */
  blockTrackers?: boolean;
  /** Extra hostname substrings to block during capture. Default none. */
  blockHosts?: string[];
  /** Playwright resource types to block (e.g. "media", "font", "image"). Default none. */
  blockResourceTypes?: string[];
}

/**
 * Capture-mode settings applied to every URL-based capture, split into the two halves of the
 * mental model: `signals` into the site, and `cleanup` the tool applies itself.
 */
export interface CaptureSettingsInput {
  /** Capture-mode flags delivered into the site (the site must read one). */
  signals?: CaptureSignalsInput;
  /** Noise the tool removes itself (no site cooperation needed). */
  cleanup?: CaptureCleanupInput;
}

export interface ShowcaseSettingsInput {
  // --- output & run behavior ---
  /** Output directory for generated assets, relative to the repo root (default "pro-visu"). */
  outDir?: string;
  /** How many assets to generate in parallel (shared browser, separate contexts). */
  concurrency?: number;
  /** Log verbosity for `generate` and `list`. (Render quality is set with --draft, not here.) */
  logLevel?: LogLevel;
  /** Skip assets whose inputs+options+tool fingerprint is unchanged (opt-in). */
  cache?: boolean;

  // --- capture environment ---
  /** Playwright launch controls. */
  browser?: BrowserSettingsInput;
  /** Build → start → wait → capture → stop a server automatically. */
  server?: ServerSettingsInput;

  // --- capture-mode + generator defaults ---
  /** Capture-mode settings applied to every URL-based asset (hide the cookie banner, block trackers, seed cookies, …). */
  capture?: CaptureSettingsInput;
  /** Per-generator option defaults, keyed by generator id, merged under each asset. */
  defaults?: {
    "scroll-reel"?: ScrollReelOptions;
    interaction?: InteractionOptions;
    screenshots?: ScreenshotsOptions;
    wall?: WallOptions;
    specimen?: SpecimenOptions;
    icons?: IconsOptions;
    palette?: PaletteOptions;
    "palette-reel"?: PaletteReelOptions;
  };
}

/** Fields common to every asset. */
export interface AssetBaseInput {
  /** Unique id for this asset — also the output filename (`<slug(name)>.mp4`) and manifest key. */
  name: string;
}

/**
 * Discriminated by `generator` so each asset gets the right `options` autocomplete. URL-based
 * generators take a `url` — absolute, or a `/path` resolved against the managed server; omit it
 * to capture the managed server's root. Local generators (wall, specimen, icons, palette) need none.
 * Asset dependencies are derived from options (e.g. a wall's column tiles) — there is no
 * authored `inputs` map.
 */
export type AssetSpecInput =
  | (AssetBaseInput & { url?: string; generator: "scroll-reel"; options?: ScrollReelOptions })
  | (AssetBaseInput & { url?: string; generator: "interaction"; options: InteractionOptions })
  | (AssetBaseInput & { url?: string; generator: "screenshots"; options?: ScreenshotsOptions })
  | (AssetBaseInput & { generator: "wall"; options: WallOptions })
  | (AssetBaseInput & { generator: "specimen"; options: SpecimenOptions })
  | (AssetBaseInput & { generator: "icons"; options: IconsOptions })
  | (AssetBaseInput & { generator: "palette"; options: PaletteOptions })
  | (AssetBaseInput & { generator: "palette-reel"; options: PaletteReelOptions });

export interface ShowcaseUserConfig {
  settings?: ShowcaseSettingsInput;
  assets: AssetSpecInput[];
}

/**
 * Identity helper that gives `pro-visu.config.ts` full type-checking + autocomplete. To split a
 * config across modules, type the pieces with `satisfies` instead:
 * `export const reels = [...] satisfies AssetSpecInput[]`.
 */
export function defineConfig(config: ShowcaseUserConfig): ShowcaseUserConfig {
  return config;
}
