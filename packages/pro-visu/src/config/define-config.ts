import type { WallOptions } from "@/generators/wall/options";
import type { IconsOptions } from "@/generators/icons/options";
import type { PaletteOptions } from "@/generators/palette/options";
import type { SpecimenOptions } from "@/generators/specimen/options";
import type { ScrollReelOptions } from "@/generators/scroll-reel/options";
import type { InteractionOptions } from "@/generators/interaction/options";
import type { ScreenshotsOptions } from "@/generators/screenshots/options";
import type { PaletteReelOptions } from "@/generators/palette-reel/options";

/**
 * Author-facing config types. These power editor autocomplete in `pro-visu.config.ts`.
 * The runtime validator lives in `schema.ts`; each generator validates its own options.
 * When a new generator is added, extend `AssetSpecInput` and `defaults` here.
 */

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

/**
 * `enabled` toggle for an asset or the global `settings`. `true`/`false` switch on/off; a string
 * tags an asset into a named group (e.g. "quick-test") that `settings.enabled` can select.
 */
export type EnabledFlag = boolean | string;

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
   * Command that starts the server, run via the shell. **Defaults to your project's start script**
   * (`<pm> start`, e.g. `pnpm start`), detected from the lockfile — set it only to override. The
   * tool sets PORT/HOST in its environment to the readiness port/host, so frameworks that honor
   * PORT (Next, Vite, …) bind it automatically. An explicit flag (e.g. `next start -p 4000`) wins.
   *
   * @default "<pm> start" — your project's start script (e.g. `pnpm start` / `npm run start`)
   */
  command?: string;
  /**
   * One-shot build run before starting, e.g. `next build`. **Defaults to your project's build
   * script** (`<pm> build`, e.g. `pnpm build`); set `false` to skip the build step (already-built
   * or dev-server setups).
   *
   * @default "<pm> build" — your project's build script (e.g. `pnpm build` / `npm run build`)
   */
  build?: string | false;
  /**
   * Health-check URL polled until it responds.
   * @default "http://127.0.0.1:<port>"
   */
  url?: string;
  /**
   * Port the readiness check polls — also derives `url` when `url` is omitted, and is passed to
   * the command as PORT so it binds the same port automatically.
   * @default 3101
   */
  port?: number;
  /**
   * Working dir for build + command, relative to the repo root (where the CLI runs).
   * @default "the repo root"
   */
  cwd?: string;
  /**
   * Max time to wait for the server to become reachable, in ms.
   * @default 120000
   */
  readyTimeoutMs?: number;
  /**
   * If a server is already reachable at the URL, use it as-is (don't start/stop one).
   * @default true
   */
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

/**
 * Per-asset cleanup override. A sparse partial of the global `cleanup` — omit a key to inherit it.
 * Array fields (`hideSelectors`, `clickSelectors`, `blockHosts`, `blockResourceTypes`) are ADDITIVE:
 * they layer on top of the globals. Use the subtraction escapes to remove inherited entries.
 */
export interface CaptureCleanupOverrideInput {
  /** Extra selectors to hide, added on top of the global `hideSelectors`. */
  hideSelectors?: string[];
  /** Un-hide: selectors to REMOVE from the inherited global `hideSelectors` (e.g. show a globally-hidden cookie banner in this asset). */
  showSelectors?: string[];
  /** Extra CSS, appended to the global `injectCss` for this asset. */
  injectCss?: string;
  /** Extra selectors to click, added on top of the global `clickSelectors`. */
  clickSelectors?: string[];
  /** Override the global `hideScrollbars` for this asset. Omit to inherit. */
  hideScrollbars?: boolean;
  /** Override the global `pauseAnimations` for this asset. Omit to inherit. */
  pauseAnimations?: boolean;
  /** Override the global `freezeClock` for this asset. Omit to inherit. */
  freezeClock?: boolean;
  /** Override the global `blockTrackers` for this asset. Omit to inherit. */
  blockTrackers?: boolean;
  /** Extra hostname substrings to block, added on top of the global `blockHosts`. */
  blockHosts?: string[];
  /** Un-block: hostname substrings to REMOVE from the inherited global `blockHosts`. */
  unblockHosts?: string[];
  /** Extra Playwright resource types to block, added on top of the global `blockResourceTypes`. */
  blockResourceTypes?: string[];
}

/**
 * A single asset's capture override, deep-merged OVER `settings.capture` when the asset runs. Lets
 * one asset show off something the global config hides (or tune any signal/cleanup) without touching
 * the global. Signals merge (records by key, cookies by name); cleanup arrays are additive with
 * `showSelectors`/`unblockHosts` to subtract; booleans/strings override. Omit a key to inherit.
 */
export interface CaptureOverrideInput {
  /** Per-asset capture signals, merged over the global ones. */
  signals?: CaptureSignalsInput;
  /** Per-asset cleanup overrides, merged over the global ones. */
  cleanup?: CaptureCleanupOverrideInput;
}

export interface ShowcaseSettingsInput {
  // --- output & run behavior ---
  /**
   * Which assets to run. `true` (default) runs every asset that isn't individually disabled;
   * `false` runs none; a group string (e.g. "quick-test") runs only the assets whose own
   * `enabled` matches it. Explicit `--asset` selection on the CLI overrides this.
   */
  enabled?: EnabledFlag;
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
  /**
   * Run this asset? `true` (default) includes it; `false` skips it without deleting or commenting
   * it out; a group string (e.g. "quick-test") tags it for selection via `settings.enabled`.
   */
  enabled?: EnabledFlag;
  /**
   * Per-asset overrides of `settings.capture`, deep-merged over it for this asset only — e.g. show a
   * globally-hidden element with `capture: { cleanup: { showSelectors: ["#cookie-banner"] } }`, or
   * flip a toggle like `freezeClock`. Omit to inherit the global capture settings unchanged.
   */
  capture?: CaptureOverrideInput;
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
