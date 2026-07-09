import path from "node:path";

import { CONFIG_DIR } from "@/config/defaults";

/** Resolve a working directory to an absolute path (defaults to process.cwd()). */
export function resolveCwd(cwd?: string): string {
  return path.resolve(cwd ?? process.cwd());
}

/**
 * The directory that holds the config file, its nested modules, and output: the dir of the
 * discovered config file, or `<cwd>/pro-visu/` when there is none (init/list fallbacks).
 */
export function resolveConfigDir(cwd: string, configFile?: string): string {
  return configFile ? path.dirname(configFile) : path.join(cwd, CONFIG_DIR);
}

/** Resolve the output directory (default `output`) against the config dir (`<repo>/pro-visu/`). */
export function resolveOutDir(configDir: string, outDir: string): string {
  return path.resolve(configDir, outDir);
}

/** Per-generator subdirectory inside the output dir, e.g. `pro-visu/scroll-reel`. */
export function generatorDir(outDir: string, generatorId: string): string {
  return path.join(outDir, generatorId);
}

/** Normalize a path to forward slashes (for stable, cross-platform manifest entries). */
function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/** Path of `to` relative to `from`, normalized to forward slashes. */
export function relPosix(from: string, to: string): string {
  return toPosix(path.relative(from, to));
}

/** Turn an asset name into a safe filename slug. */
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}
