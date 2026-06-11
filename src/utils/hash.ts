import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/** sha256 hex digest of a file's contents. */
export async function sha256File(file: string): Promise<string> {
  const buf = await readFile(file);
  return createHash("sha256").update(buf).digest("hex");
}
