import { z } from "zod";

/** Friendly log levels surfaced in config + CLI. */
const logLevelSchema = z.enum(["silent", "error", "warn", "info", "debug"]);
export type LogLevel = z.infer<typeof logLevelSchema>;

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
    /** Launch timeout (ms). */
    timeout: z
      .number()
      .int()
      .nonnegative()
      .default(30_000)
      .describe("Browser launch timeout in ms (default 30000)."),
  })
  .strict();
export type ResolvedBrowserSettings = z.infer<typeof browserSettingsSchema>;

/**
 * Optional managed server. When set, `pro-visu generate` builds (if given), starts the
 * server, waits for it to respond, runs the capture, then shuts it down — so a project's
 * npm script can be just `pro-visu generate`.
 */
export const serverSettingsSchema = z
  .object({
    /**
     * Command that starts the server, run via the shell. The tool sets PORT/HOST in the
     * command's environment to the readiness port/host, so frameworks that honor PORT (Next,
     * Vite, …) bind it automatically — `command: "next start"` is enough. An explicit flag
     * (e.g. `next start -p 4000`) still wins.
     */
    command: z
      .string()
      .min(1)
      .describe("Command that starts the server, run via the shell. PORT/HOST are set in its env so PORT-honoring frameworks bind automatically."),
    /** Optional one-shot build to run first, e.g. "next build". */
    build: z
      .string()
      .min(1)
      .optional()
      .describe('Optional one-shot build to run first, e.g. "next build".'),
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
    /** Working dir for build + command, relative to the config dir. Defaults to it. */
    cwd: z
      .string()
      .optional()
      .describe("Working dir for build + command, relative to the config dir. Defaults to it."),
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

/** Repo-level CLI behavior (the `settings` block). */
export const settingsSchema = z.object({
  /** Output directory, relative to the repo root. */
  outDir: z
    .string()
    .min(1)
    .default("pro-visu")
    .describe('Output directory for generated assets, relative to the repo root (default "pro-visu").'),
  /** How many assets to generate in parallel (shared browser, separate contexts). */
  concurrency: z
    .number()
    .int()
    .positive()
    .default(2)
    .describe("How many assets to generate in parallel, sharing one browser with separate contexts (default 2)."),
  /**
   * Raise the Node heap (V8 old-space) to this many MB for the run. Heavy jobs — large frame-stepped
   * walls especially — can exceed Node's default ~4 GB limit and crash with "JavaScript heap out of
   * memory". When set above the current limit, the CLI re-execs itself with `--max-old-space-size`.
   * (This is the Node process heap, not the browser's — the browser manages its own memory.)
   */
  maxMemoryMB: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Raise the Node heap (V8 old-space) to this many MB to avoid out-of-memory on heavy jobs; re-execs with --max-old-space-size."),
  logLevel: logLevelSchema.default("info").describe("CLI log verbosity (default \"info\")."),
  browser: browserSettingsSchema.default({}).describe("Playwright launch controls."),
  /**
   * Per-generator option defaults, keyed by generator id, merged underneath each asset's
   * own `options`. Validated loosely here; each generator validates its own option shape.
   */
  defaults: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .default({})
    .describe("Per-generator option defaults, keyed by generator id, merged underneath each asset's own options."),
  /** Optional managed dev/prod server lifecycle (build → start → wait → … → stop). */
  server: serverSettingsSchema
    .optional()
    .describe("Build → start → wait → capture → stop a server automatically."),
  /** Render quality. "draft" lowers fps/scale and speeds the encoder for fast iteration. */
  quality: z
    .enum(["draft", "final"])
    .default("final")
    .describe('Render quality; "draft" lowers fps/scale and speeds the encoder for fast iteration (default "final").'),
  /** Skip assets whose inputs+options+tool fingerprint is unchanged (opt-in; can be stale). */
  cache: z
    .boolean()
    .default(false)
    .describe("Skip assets whose inputs+options+tool fingerprint is unchanged (opt-in; can be stale). Default false."),
});
export type ResolvedSettings = z.infer<typeof settingsSchema>;

/** One thing to generate. Options are validated by the target generator at run time. */
export const assetSpecSchema = z
  .object({
    name: z.string().min(1),
    /**
     * Page to capture: an absolute `https://…` URL, or a path like `/shop` resolved against the
     * managed server's URL. Optional — with a managed server, a url-based asset that omits it
     * captures the server root; local generators (`scene`, `palette`) need no url.
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
    /**
     * Other assets this one consumes, as `{ slotName: assetName }`. The producing assets run
     * first and their output files are exposed to this asset (e.g. a scene playing an earlier
     * recording). Forms a DAG; cycles are rejected.
     */
    inputs: z.record(z.string(), z.string()).default({}),
  })
  .strict();
export type ResolvedAssetSpec = z.infer<typeof assetSpecSchema>;

export const showcaseConfigSchema = z
  .object({
    settings: settingsSchema.default({}),
    assets: z.array(assetSpecSchema).min(1, "Define at least one asset in `assets`."),
  })
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
