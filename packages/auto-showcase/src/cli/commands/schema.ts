import path from "node:path";
import { writeFile } from "node:fs/promises";
import { resolveCwd } from "@/utils/paths";
import { ensureDir } from "@/utils/fs";
import { createLogger } from "@/utils/logger";
import { serializeConfigJsonSchema } from "@/config/json-schema";

export const DEFAULT_SCHEMA_FILE = "showcase.schema.json";

export interface SchemaOptions {
  cwd?: string;
  /** Output path, relative to cwd (default showcase.schema.json). */
  out?: string;
}

/**
 * Write a JSON Schema for `showcase.config.json` so editors give autocomplete + validation for a
 * dependency-free (JSON) config. Reference it from the config with `"$schema": "./showcase.schema.json"`.
 * Re-run after upgrading the tool to refresh the schema to the new version.
 */
export async function runSchema(options: SchemaOptions = {}): Promise<void> {
  const cwd = resolveCwd(options.cwd);
  const logger = createLogger("info");
  const outPath = path.resolve(cwd, options.out ?? DEFAULT_SCHEMA_FILE);

  await ensureDir(path.dirname(outPath));
  await writeFile(outPath, serializeConfigJsonSchema(), "utf8");
  logger.success(`wrote ${path.relative(cwd, outPath) || DEFAULT_SCHEMA_FILE}`);
  logger.info('Reference it from your JSON config: "$schema": "./showcase.schema.json"');
}
