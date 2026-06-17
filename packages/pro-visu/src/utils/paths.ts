import path from "node:path";

/** Resolve a working directory to an absolute path (defaults to process.cwd()). */
export function resolveCwd(cwd?: string): string {
  return path.resolve(cwd ?? process.cwd());
}

/** Resolve the output directory (e.g. `pro-visu/`) against the consuming repo root. */
export function resolveOutDir(cwd: string, outDir: string): string {
  return path.resolve(cwd, outDir);
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
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "asset"
  );
}
