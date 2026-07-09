import { z } from "zod";
import { DEFAULT_OUTDIR, DEFAULT_CONCURRENCY } from "@/config/defaults";

/** Friendly log levels surfaced in config + CLI. */
const logLevelSchema = z.enum(["silent", "error", "warn", "info", "debug"]);
export type LogLevel = z.infer<typeof logLevelSchema>;

/**
 * `enabled` toggle shared by each asset and the global `settings`. `true`/`false` switch an asset
 * on/off; a string tags it into a named group (e.g. "quick-test"). Setting `settings.enabled` to a
 * group string runs only the assets tagged with it — a fast way to swap between quality passes.
 */
const enabledSchema = z.union([z.boolean(), z.string().min(1)]);
export type EnabledFlag = z.infer<typeof enabledSchema>;

/** Playwright launch controls, settable per-repo. */
const browserSettingsSchema = z
  .object({
    headless: z
      .boolean()
      .default(true)
      .describe("Run the browser without a visible window (default true). Set false to watch captures."),
    /** Browser channel, e.g. "chrome" or "msedge". Omit to use the managed Chromium. */
    channel: z
      .string()
      .optional()
      .describe('Browser channel, e.g. "chrome" or "msedge". Omit to use the managed Chromium.'),
    /** Absolute path to a browser executable (overrides channel + managed Chromium). */
    executablePath: z
      .string()
      .optional()
      .describe("Absolute path to a browser executable (overrides channel + managed Chromium)."),
    /** Extra launch args, e.g. ["--no-sandbox"] on CI. */
    args: z
      .array(z.string())
      .default([])
      .describe('Extra launch args, e.g. ["--no-sandbox"] on CI.'),
    /** Browser launch timeout (ms). Named to match server.readyTimeoutMs. */
    launchTimeoutMs: z
      .number()
      .int()
      .nonnegative()
      .default(30_000)
      .describe("Browser launch timeout in ms (default 30000)."),
  })
  .strict();
export type ResolvedBrowserSettings = z.infer<typeof browserSettingsSchema>;

/**
 * Optional managed server. When set (even as `{}`), `pro-visu generate` builds, starts the
 * server, waits for it to respond, runs the capture, then shuts it down — so a project's
 * npm script can be just `pro-visu generate`. `build` and `command` default to the project's own
 * package scripts (`<pm> build` / `<pm> start`, detected from the lockfile), so it follows along
 * with whatever those scripts do without needing to be set.
 */
export const serverSettingsSchema = z
  .object({
    /**
     * Command that starts the server, run via the shell. Defaults to the project's `<pm> start`
     * script (e.g. `pnpm start`). The tool sets PORT/HOST in the command's environment to the
     * readiness port/host, so frameworks that honor PORT (Next, Vite, …) bind it automatically.
     * An explicit flag (e.g. `next start -p 4000`) still wins.
     */
    command: z
      .string()
      .min(1)
      .optional()
      .describe("Command that starts the server, run via the shell. Defaults to the project's `<pm> start` script. PORT/HOST are set in its env so PORT-honoring frameworks bind automatically."),
    /**
     * One-shot build to run before starting, e.g. "next build". Defaults to the project's
     * `<pm> build` script; set `false` to skip building (already-built or dev-server setups).
     */
    build: z
      .union([z.string().min(1), z.literal(false)])
      .optional()
      .describe("One-shot build run before starting. Defaults to the project's `<pm> build` script; set false to skip it."),
    /** Health-check URL polled until it responds. Defaults to http://127.0.0.1:<port>. */
    url: z
      .string()
      .url()
      .optional()
      .describe("Health-check URL polled until it responds. Defaults to http://127.0.0.1:<port>."),
    /**
     * Port the readiness check polls — also derives `url` when `url` is omitted, and is passed to
     * the command as the PORT env var so it binds the same port automatically. Defaults to 3101
     * (off the common 3000 dev port).
     */
    port: z
      .number()
      .int()
      .positive()
      .default(3101)
      .describe("Port the readiness check polls; also derives `url` and is passed as PORT so the server binds it. Defaults to 3101."),
    /** Working dir for build + command, relative to the repo root (where the CLI runs). Defaults to it. */
    cwd: z
      .string()
      .optional()
      .describe("Working dir for build + command, relative to the repo root (where the CLI runs), so scripts run against your app. Defaults to the repo root."),
    /** Max time to wait for the server to become reachable (ms). */
    readyTimeoutMs: z
      .number()
      .int()
      .positive()
      .default(120_000)
      .describe("Max time to wait for the server to become reachable, in ms (default 120000)."),
    /** If a server is already reachable at the URL, use it as-is (don't start or stop one). */
    reuseExisting: z
      .boolean()
      .default(true)
      .describe("If a server is already reachable at the URL, use it as-is (don't start or stop one). Default true."),
  })
  .strict();
export type ResolvedServerSettings = z.infer<typeof serverSettingsSchema>;

/**
 * Signals INTO the site — a "capture mode" flag delivered four ways (query / cookies /
 * localStorage / initScript). The site must READ one and render capture-friendly (reveals
 * settled, count-ups final, …). A cookie can also carry a session/auth value for login-gated pages.
 */
const captureSignalsSchema = z
  .object({
    /** Query params appended to every URL-based asset (e.g. `{ capture: "1" }` → `?capture=1`). */
    query: z
      .record(z.string(), z.string())
      .optional()
      .describe('Query params appended to every URL-based asset, e.g. { capture: "1" }.'),
    /** Cookies set on every capture context before navigation, scoped to the asset's origin. */
    cookies: z
      .array(z.object({ name: z.string().min(1), value: z.string() }).strict())
      .optional()
      .describe("Cookies set on every capture context before navigation (scoped to the asset's origin)."),
    /** localStorage entries seeded before the page's own scripts run. */
    localStorage: z
      .record(z.string(), z.string())
      .optional()
      .describe("localStorage entries seeded (per origin) before the page's own scripts run."),
    /** JS source run in every page before its own scripts — e.g. set a global capture flag. */
    initScript: z
      .string()
      .optional()
      .describe("JS run in every page before its own scripts (e.g. `window.__PV_CAPTURE__ = true`)."),
  })
  .strict();

/**
 * Cleanup applied BY the tool — needs no site cooperation. Suppression CSS, overlay dismissal,
 * scrollbar/animation/clock control, and network blocking, applied uniformly before every capture.
 */
const captureCleanupSchema = z
  .object({
    /** Hide elements matching these CSS selectors before capture (cookie banners, chat widgets, …). */
    hideSelectors: z
      .array(z.string())
      .default([])
      .describe("Hide elements matching these CSS selectors before capture (cookie banners, chat widgets, …). Default none."),
    /** Extra CSS injected before capture (e.g. a brand backdrop, or hiding a sticky header). */
    injectCss: z
      .string()
      .optional()
      .describe("Extra CSS injected before capture (e.g. a brand backdrop, or hiding a sticky header). Omit for none."),
    /** Click these selectors once after load to dismiss overlays (consent dialogs); best-effort. */
    clickSelectors: z
      .array(z.string())
      .default([])
      .describe("Click these selectors once after load to dismiss overlays (consent dialogs); best-effort. Default none."),
    /** Hide scrollbars so they don't appear in captures. */
    hideScrollbars: z
      .boolean()
      .default(true)
      .describe("Hide scrollbars so they don't appear in captures. Default true."),
    /** Pause CSS animations/transitions for fully static, deterministic captures. */
    pauseAnimations: z
      .boolean()
      .default(false)
      .describe("Pause CSS animations/transitions for fully static, deterministic captures. Default false."),
    /** Freeze Date.now / performance.now / Math.random (seeded) so time/random content is stable. */
    freezeClock: z
      .boolean()
      .default(false)
      .describe("Freeze Date.now / performance.now / Math.random (seeded) so time/random content is stable. Default false."),
    /** Abort common analytics/ads/session-replay requests during capture (cleaner, faster). */
    blockTrackers: z
      .boolean()
      .default(true)
      .describe("Abort common analytics/ads/session-replay requests during capture (cleaner, faster). Default true."),
    /** Extra hostname substrings to block during capture. */
    blockHosts: z
      .array(z.string())
      .default([])
      .describe("Extra hostname substrings to block during capture. Default none."),
    /** Playwright resource types to block (e.g. "media", "font", "image"). */
    blockResourceTypes: z
      .array(z.string())
      .default([])
      .describe('Playwright resource types to block (e.g. "media", "font", "image"). Default none.'),
  })
  .strict();

/**
 * "Capture mode" settings applied to every URL-based capture (scroll-reel, screenshots,
 * interaction), so a site renders a clean, settled snapshot while keeping that behavior for real
 * users. Two halves, split so the shape mirrors the mental model:
 * - `signals` — flags INTO the site (the site must read one and render capture-friendly).
 * - `cleanup` — noise the tool removes itself (needs no site cooperation).
 */
export const captureSettingsSchema = z
  .object({
    signals: captureSignalsSchema.default({}).describe("Capture-mode flags delivered into the site (the site must read one)."),
    cleanup: captureCleanupSchema.default({}).describe("Noise the tool removes itself (no site cooperation needed)."),
  })
  .strict();
export type ResolvedCaptureSettings = z.infer<typeof captureSettingsSchema>;

/**
 * Repo-level CLI behavior (the `settings` block). Fields are grouped: output & run behavior, then
 * the capture environment (browser + managed server), then capture-mode settings and per-generator
 * defaults. Render quality is not persisted here — it's an iteration-time choice, set with `--draft`.
 */
export const settingsSchema = z.object({
  // --- output & run behavior ---
  /**
   * Which assets to run. `true` (default) runs every asset that isn't individually disabled;
   * `false` runs none; a group string (e.g. "quick-test") runs only the assets tagged with that
   * same string in their own `enabled`. Explicit `--asset` selection on the CLI overrides this.
   */
  enabled: enabledSchema
    .default(true)
    .describe('Which assets to run: true (all not individually disabled), false (none), or a group string that runs only assets whose `enabled` matches (e.g. "quick-test").'),
  /** Output directory, relative to the `pro-visu/` config dir (so the default lands in pro-visu/output/). */
  outDir: z
    .string()
    .min(1)
    .default(DEFAULT_OUTDIR)
    .describe(`Output directory for generated assets, relative to the pro-visu/ config dir (default "${DEFAULT_OUTDIR}", i.e. pro-visu/output/).`),
  /** How many assets to generate in parallel (shared browser, separate contexts). */
  concurrency: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_CONCURRENCY)
    .describe(`How many assets to generate in parallel, sharing one browser with separate contexts (default ${DEFAULT_CONCURRENCY}).`),
  logLevel: logLevelSchema
    .default("info")
    .describe('Log verbosity for `generate` and `list` (default "info"); --verbose forces "debug" on generate. `doctor` always reports in full.'),
  /** Skip assets whose inputs+options+tool fingerprint is unchanged (opt-in; can be stale). */
  cache: z
    .boolean()
    .default(false)
    .describe("Skip assets whose inputs+options+tool fingerprint is unchanged (opt-in; can be stale). Default false."),

  // --- capture environment ---
  browser: browserSettingsSchema.default({}).describe("Playwright launch controls."),
  /** Optional managed dev/prod server lifecycle (build → start → wait → … → stop). */
  server: serverSettingsSchema
    .optional()
    .describe("Build → start → wait → capture → stop a server automatically."),

  // --- capture-mode + generator defaults ---
  /** Capture-mode settings (site signals + tool-side cleanup) applied to every URL capture. */
  capture: captureSettingsSchema
    .default({})
    .describe("Capture-mode settings applied to every URL-based asset (hide the cookie banner, block trackers, seed cookies, …)."),
  /**
   * Per-generator option defaults, keyed by generator id, merged underneath each asset's
   * own `options`. Validated loosely here; each generator validates its own option shape.
   */
  defaults: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .default({})
    .describe("Per-generator option defaults, keyed by generator id, merged underneath each asset's own options."),
}).strict();
export type ResolvedSettings = z.infer<typeof settingsSchema>;

/**
 * One thing to generate. Options are validated by the target generator at run time.
 *
 * Asset dependencies are NOT authored: generators derive them from their own options (e.g. a
 * wall's columns name the assets they stack), and the pipeline stamps the derived `inputs` map
 * onto the parsed spec before building the DAG. The transform seeds the (internal) empty map.
 */
export const assetSpecSchema = z
  .object({
    name: z.string().min(1),
    /**
     * Whether to run this asset. `true` (default) includes it; `false` leaves it out without
     * deleting or commenting it; a group string (e.g. "quick-test") tags it so `settings.enabled`
     * set to the same string runs only that group. Dependencies of a running asset are pulled in
     * regardless of their own `enabled`.
     */
    enabled: enabledSchema
      .default(true)
      .describe('Run this asset? true (default), false to skip it, or a group string (e.g. "quick-test") selected via settings.enabled.'),
    /**
     * Page to capture: an absolute `https://…` URL, or a path like `/shop` resolved against the
     * managed server's URL. Optional — with a managed server, a url-based asset that omits it
     * captures the server root; local generators (`specimen`, `palette`, `wall`, …) need no url.
     */
    url: z
      .string()
      .min(1)
      .refine((s) => /^https?:\/\//i.test(s) || s.startsWith("/"), {
        message:
          'url must be an absolute http(s) URL or a path starting with "/" (resolved against the managed server)',
      })
      .optional(),
    generator: z.string().min(1),
    options: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()
  .transform((a) => ({ ...a, inputs: {} as Record<string, string> }));
export type ResolvedAssetSpec = z.infer<typeof assetSpecSchema>;

export const showcaseConfigSchema = z
  .object({
    /** JSON configs may carry an editor `$schema` pointer; accepted and ignored at runtime. */
    $schema: z.string().optional(),
    settings: settingsSchema.default({}),
    assets: z.array(assetSpecSchema).min(1, "Define at least one asset in `assets`."),
  })
  .strict()
  .superRefine((cfg, ctx) => {
    const seen = new Set<string>();
    for (const [i, asset] of cfg.assets.entries()) {
      if (seen.has(asset.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate asset name "${asset.name}" — names must be unique.`,
          path: ["assets", i, "name"],
        });
      }
      seen.add(asset.name);
    }
  });
export type ResolvedConfig = z.infer<typeof showcaseConfigSchema>;
