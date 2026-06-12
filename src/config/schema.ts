import { z } from "zod";

/** Friendly log levels surfaced in config + CLI. */
export const logLevelSchema = z.enum(["silent", "error", "warn", "info", "debug"]);
export type LogLevel = z.infer<typeof logLevelSchema>;

/** Playwright launch controls, settable per-repo. */
export const browserSettingsSchema = z
  .object({
    headless: z.boolean().default(true),
    /** Browser channel, e.g. "chrome" or "msedge". Omit to use the managed Chromium. */
    channel: z.string().optional(),
    /** Absolute path to a browser executable (overrides channel + managed Chromium). */
    executablePath: z.string().optional(),
    /** Extra launch args, e.g. ["--no-sandbox"] on CI. */
    args: z.array(z.string()).default([]),
    /** Launch timeout (ms). */
    timeout: z.number().int().nonnegative().default(30_000),
  })
  .strict();
export type ResolvedBrowserSettings = z.infer<typeof browserSettingsSchema>;

/**
 * Optional managed server. When set, `showcase generate` builds (if given), starts the
 * server, waits for it to respond, runs the capture, then shuts it down — so a project's
 * npm script can be just `showcase generate`.
 */
export const serverSettingsSchema = z
  .object({
    /** Command that starts the server, run via the shell, e.g. "next start -p 3000". */
    command: z.string().min(1),
    /** Optional one-shot build to run first, e.g. "next build". */
    build: z.string().min(1).optional(),
    /** Health-check URL polled until it responds. Defaults to http://127.0.0.1:<port>. */
    url: z.string().url().optional(),
    /** Port — used to derive `url` when `url` is omitted. */
    port: z.number().int().positive().optional(),
    /** Working dir for build + command, relative to the config dir. Defaults to it. */
    cwd: z.string().optional(),
    /** Max time to wait for the server to become reachable (ms). */
    readyTimeoutMs: z.number().int().positive().default(120_000),
    /** If a server is already reachable at the URL, use it as-is (don't start or stop one). */
    reuseExisting: z.boolean().default(true),
  })
  .strict()
  .refine((s) => Boolean(s.url) || s.port != null, {
    message: "server requires `url` or `port`.",
  });
export type ResolvedServerSettings = z.infer<typeof serverSettingsSchema>;

/** Repo-level CLI behavior (the `settings` block). */
export const settingsSchema = z.object({
  /** Output directory, relative to the repo root. */
  outDir: z.string().min(1).default("showcase"),
  /** How many assets to generate in parallel (shared browser, separate contexts). */
  concurrency: z.number().int().positive().default(2),
  logLevel: logLevelSchema.default("info"),
  browser: browserSettingsSchema.default({}),
  /**
   * Per-generator option defaults, keyed by generator id, merged underneath each asset's
   * own `options`. Validated loosely here; each generator validates its own option shape.
   */
  defaults: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  /** Optional managed dev/prod server lifecycle (build → start → wait → … → stop). */
  server: serverSettingsSchema.optional(),
});
export type ResolvedSettings = z.infer<typeof settingsSchema>;

/** One thing to generate. Options are validated by the target generator at run time. */
export const assetSpecSchema = z
  .object({
    name: z.string().min(1),
    /** Page to capture. Required by url-based generators; omitted for local `scene` assets. */
    url: z.string().url().optional(),
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
