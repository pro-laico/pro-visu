import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

/**
 * sha256 hex digest of a file's contents, streamed — generated videos can run large, and hashes
 * are computed concurrently across assets, so reading whole files into memory spikes badly.
 */
export async function sha256File(file: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

/** sha256 hex digest of an in-memory buffer. */
export function sha256Buffer(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}
