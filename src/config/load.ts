import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadConfig } from "c12";
import type { ZodError } from "zod";
import { showcaseConfigSchema, type ResolvedConfig } from "@/config/schema";
import { CONFIG_NAME } from "@/config/defaults";

export class ConfigNotFoundError extends Error {
  constructor(public readonly cwd: string) {
    super(
      `No showcase config found in ${cwd}.\n` +
        "Run `showcase init` to create one, or pass --config <path>.",
    );
    this.name = "ConfigNotFoundError";
  }
}

export class ConfigValidationError extends Error {
  constructor(
    public readonly zodError: ZodError,
    public readonly file?: string,
  ) {
    super("Invalid showcase config.");
    this.name = "ConfigValidationError";
  }
}

export interface LoadedConfig {
  config: ResolvedConfig;
  /** Absolute path of the discovered config file, if it came from a file. */
  configFile?: string;
}

export interface LoadOptions {
  cwd: string;
  /** Explicit config path from --config. */
  configFile?: string;
}

/** rc files in the JS ecosystem (.prettierrc, .eslintrc) are JSON — treat ours the same. */
const RC_FILES = [".showcaserc.json", ".showcaserc"];

/**
 * Discover + load the repo config (showcase.config.{ts,js,mjs,cjs,json}, .showcaserc[.json],
 * or a `showcase` key in package.json), then validate it with zod.
 */
export async function loadShowcaseConfig(opts: LoadOptions): Promise<LoadedConfig> {
  // 1. Explicit --config wins.
  if (opts.configFile) {
    const abs = path.resolve(opts.cwd, opts.configFile);
    if (!existsSync(abs)) throw new Error(`Config file not found: ${abs}`);
    if (abs.endsWith(".json") || RC_FILES.some((rc) => abs.endsWith(rc))) {
      return validate(readJson(abs), abs);
    }
    return loadViaC12({ ...opts, configFile: abs });
  }

  // 2. rc files (parsed as JSON), highest precedence among discovered files.
  const rc = findRcJson(opts.cwd);
  if (rc) return validate(rc.data, rc.file);

  // 3. c12 discovery: showcase.config.* and the package.json "showcase" key.
  return loadViaC12(opts);
}

async function loadViaC12(opts: LoadOptions): Promise<LoadedConfig> {
  const result = await loadConfig<Record<string, unknown>>({
    cwd: opts.cwd,
    name: CONFIG_NAME,
    configFile: opts.configFile,
    rcFile: false,
    packageJson: true,
    globalRc: false,
    dotenv: false,
  });

  const raw = result.config ?? {};
  const hasContent = Object.keys(raw).length > 0;
  const hasFile = !!result.configFile && existsSync(result.configFile);
  const hasLayer = (result.layers ?? []).some(
    (layer) => layer.config && Object.keys(layer.config).length > 0,
  );

  if (!hasContent && !hasFile && !hasLayer) {
    throw new ConfigNotFoundError(opts.cwd);
  }
  return validate(raw, result.configFile);
}

function validate(raw: unknown, file?: string): LoadedConfig {
  const parsed = showcaseConfigSchema.safeParse(raw);
  if (!parsed.success) throw new ConfigValidationError(parsed.error, file);
  return { config: parsed.data, configFile: file };
}

function findRcJson(cwd: string): { data: unknown; file: string } | undefined {
  for (const name of RC_FILES) {
    const file = path.join(cwd, name);
    if (existsSync(file)) return { data: readJson(file), file };
  }
  return undefined;
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error(`Invalid JSON in ${path.basename(file)}`);
  }
}
