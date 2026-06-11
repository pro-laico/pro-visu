import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/** sha256 hex digest of a file's contents. */
export async function sha256File(file: string): Promise<string> {
  const buf = await readFile(file);
  return createHash("sha256").update(buf).digest("hex");
}

/** sha256 hex digest of an in-memory buffer. */
export function sha256Buffer(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}
