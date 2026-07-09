import path from "node:path";
import { constants } from "node:fs";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";

/** mkdir -p */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/** Does a path exist? */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** rm -rf (never throws if missing). */
export async function removeDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export interface GitignoreResult {
  /** Whether the file was modified. */
  changed: boolean;
  /** Whether a new .gitignore was created. */
  created: boolean;
}

/**
 * Idempotently ensure `entry` is present in the repo's `.gitignore`, appended under a
 * labelled comment block. Treats trailing-slash variants as equal so we never duplicate.
 */
export async function ensureGitignoreEntry(repoRoot: string, entry: string, label = "pro-visu"): Promise<GitignoreResult> {
  const file = path.join(repoRoot, ".gitignore");
  const exists = await pathExists(file);
  const content = exists ? await readFile(file, "utf8") : "";
  const normalizedEntry = entry.replace(/\/+$/, "");

  const already = content.split(/\r?\n/).map((line) => line.trim().replace(/\/+$/, "")).some((line) => line === normalizedEntry);
  if (already) return { changed: false, created: false };

  let next = content;
  if (next.length > 0 && !next.endsWith("\n")) next += "\n";
  if (next.length > 0) next += "\n";
  next += `# ${label}\n${entry}\n`;

  await writeFile(file, next, "utf8");
  return { changed: true, created: !exists };
}
