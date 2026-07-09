import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadConfig } from "c12";
import type { ZodError } from "zod";
import { showcaseConfigSchema, type ResolvedConfig } from "@/config/schema";
import { CONFIG_NAME, CONFIG_DIR } from "@/config/defaults";

export class ConfigNotFoundError extends Error {
  constructor(public readonly cwd: string) {
    super(
      `No pro-visu config found in ${path.join(cwd, CONFIG_DIR)}.\n` +
        "Run `pro-visu init` to create one, or pass --config <path>.",
    );
    this.name = "ConfigNotFoundError";
  }
}

export class ConfigValidationError extends Error {
  constructor(
    public readonly zodError: ZodError,
    public readonly file?: string,
  ) {
    super("Invalid pro-visu config.");
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
const RC_FILES = [".pro-visurc.json", ".pro-visurc"];

/**
 * Discover + load the repo config from the `pro-visu/` folder
 * (pro-visu.config.{ts,js,mjs,cjs,json} or .pro-visurc[.json]), then validate it with zod.
 * An explicit --config path escapes the folder convention and is honored as given.
 */
export async function loadShowcaseConfig(opts: LoadOptions): Promise<LoadedConfig> {
  // 1. Explicit --config wins, resolved against the cwd (may point anywhere).
  if (opts.configFile) {
    const abs = path.resolve(opts.cwd, opts.configFile);
    if (!existsSync(abs)) throw new Error(`Config file not found: ${abs}`);
    if (abs.endsWith(".json") || RC_FILES.some((rc) => abs.endsWith(rc))) {
      return validate(readJson(abs), abs);
    }
    return loadViaC12({ ...opts, configFile: abs });
  }

  // Otherwise discovery is confined to the `pro-visu/` folder.
  const configDir = path.join(opts.cwd, CONFIG_DIR);

  // 2. rc files (parsed as JSON), highest precedence among discovered files.
  const rc = findRcJson(configDir);
  if (rc) return validate(rc.data, rc.file);

  // 3. c12 discovery of pro-visu.config.* inside the folder.
  return loadViaC12(opts, configDir);
}

async function loadViaC12(opts: LoadOptions, discoverDir?: string): Promise<LoadedConfig> {
  const result = await loadConfig<Record<string, unknown>>({
    cwd: discoverDir ?? opts.cwd,
    name: CONFIG_NAME,
    configFile: opts.configFile,
    rcFile: false,
    packageJson: false,
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

function findRcJson(dir: string): { data: unknown; file: string } | undefined {
  for (const name of RC_FILES) {
    const file = path.join(dir, name);
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
