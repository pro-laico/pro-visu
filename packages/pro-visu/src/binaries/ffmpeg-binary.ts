import os from "node:os";
import path from "node:path";
import https from "node:https";
import { createHash } from "node:crypto";
import { createGunzip } from "node:zlib";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { IncomingMessage } from "node:http";
import { mkdir, rename, rm, chmod } from "node:fs/promises";

/**
 * ffmpeg binary provisioning, vendored so pro-visu carries NO `ffmpeg-static` dependency. That
 * package fetches its binary via a postinstall script, which pnpm 10+/npm block by default —
 * tripping a build-script approval prompt in every consuming repo. We instead pull the SAME
 * prebuilt static binaries `ffmpeg-static` publishes on GitHub, but on demand into a shared cache
 * (the way we already fetch Chromium), so installing pro-visu downloads nothing and prompts nothing.
 *
 * Licensing: these are the eugeneware/ffmpeg-static GPL builds. The matching LICENSE lives next to
 * each release asset (`<platform>-<arch>.LICENSE`) — see FFMPEG_RELEASE below.
 */

/** The ffmpeg-static GitHub release we pull from (ffmpeg 6.1.1). Bump alongside a binary refresh. */
const FFMPEG_RELEASE = process.env.FFMPEG_BINARY_RELEASE || "b6.1.1";

/** Base URL for the release assets (override for a private mirror via FFMPEG_BINARIES_URL). */
const BINARIES_URL = process.env.FFMPEG_BINARIES_URL || "https://github.com/eugeneware/ffmpeg-static/releases/download";

/** Platform → arches with a published static binary (the assets b6.1.1 actually ships). */
const SUPPORTED: Record<string, readonly string[]> = {
  darwin: ["x64", "arm64"],
  linux: ["x64", "ia32", "arm64", "arm"],
  win32: ["x64"],
};

/**
 * SHA-256 of each b6.1.1 `ffmpeg-<platform>-<arch>.gz` release asset (from the GitHub release's
 * asset digests). Verified against the compressed download before the binary is installed, so a
 * silently swapped release asset can't reach execution. Refresh alongside a FFMPEG_RELEASE bump.
 */
const RELEASE_SHA256: Record<string, string> = {
  "darwin-arm64": "8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa",
  "darwin-x64": "929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106",
  "linux-arm": "64b115a12f0ab77c277e3c418aae8b40ef881e75e746a0e2d066a206b9bc5172",
  "linux-arm64": "754a678672298bc68156adff58aa7385a592c2b30b1d0ae8750c45c915c4bac0",
  "linux-ia32": "169b27c078a8ecedb814cac67afccf15a9868d63e9d74ef86088adefaa500d00",
  "linux-x64": "bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa",
  "win32-x64": "8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77",
};

/**
 * The digest the download must match, or null when unverifiable: an FFMPEG_SHA256 override wins;
 * a custom release/mirror (FFMPEG_BINARY_RELEASE / FFMPEG_BINARIES_URL) without one is the
 * caller's trust decision; otherwise the pinned digest for this platform.
 */
function expectedSha256(): string | null {
  if (process.env.FFMPEG_SHA256) return process.env.FFMPEG_SHA256.toLowerCase();
  if (process.env.FFMPEG_BINARY_RELEASE || process.env.FFMPEG_BINARIES_URL) return null;
  return RELEASE_SHA256[`${process.platform}-${process.arch}`] ?? null;
}

/** Whether a prebuilt binary exists for the current platform/arch. */
export function ffmpegIsSupported(): boolean {
  return (SUPPORTED[process.platform] ?? []).includes(process.arch);
}

/** Shared cache dir for the managed binary (one copy across all projects). Override: PROVISU_FFMPEG_DIR. */
function ffmpegCacheDir(): string {
  const base = process.env.PROVISU_FFMPEG_DIR || path.join(os.homedir(), ".cache", "pro-visu", "ffmpeg");
  return path.join(base, FFMPEG_RELEASE);
}

/** Absolute path of the managed binary in the cache (a release bump lands in its own subdir). */
function ffmpegCachedBinary(): string {
  return path.join(ffmpegCacheDir(), process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
}

/** The binary path to spawn: an explicit FFMPEG_BIN override, else the managed cache binary. */
export function ffmpegBinaryPath(): string {
  return process.env.FFMPEG_BIN || ffmpegCachedBinary();
}

/** Download URL for the current platform's gzipped binary, or null if unsupported. */
function ffmpegDownloadUrl(): string | null {
  if (!ffmpegIsSupported()) return null;
  return `${BINARIES_URL}/${FFMPEG_RELEASE}/ffmpeg-${process.platform}-${process.arch}.gz`;
}

/** HTTPS GET that follows redirects (GitHub releases 302 → S3), resolving to the 200 response stream. */
function getFollowing(url: string, redirects = 5): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "pro-visu" } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirects <= 0) return reject(new Error("Too many redirects fetching ffmpeg."));
        resolve(getFollowing(new URL(res.headers.location, url).toString(), redirects - 1));
        return;
      }
      if (status !== 200) {
        res.resume();
        reject(new Error(`ffmpeg download failed: HTTP ${status} for ${url}`));
        return;
      }
      resolve(res);
    });
    req.on("error", reject);
  });
}

/** Connection-level failure codes that mean "offline / blocked", not "bad URL". */
const NETWORK_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"]);

/** Wrap a connection-level failure with an actionable offline/proxy hint. */
function withNetworkHint(err: Error): Error {
  const code = (err as NodeJS.ErrnoException).code;
  if (code && NETWORK_CODES.has(code)) {
    return new Error(
      `${err.message} — you appear to be offline or behind a proxy. Set FFMPEG_BINARIES_URL to a ` +
        `reachable mirror, or FFMPEG_BIN to a local ffmpeg binary.`,
    );
  }
  return err;
}

/**
 * Download + gunzip the static ffmpeg binary into the shared cache (atomically, via a temp file), and
 * mark it executable. Targets the managed cache path — never an FFMPEG_BIN override. Returns its path.
 * `onProgress` receives (downloadedBytes, totalBytes|undefined) as the compressed stream arrives.
 */
export async function downloadFfmpeg(onProgress?: (downloaded: number, total: number | undefined) => void): Promise<string> {
  const url = ffmpegDownloadUrl();
  if (!url) throw new Error(`No prebuilt ffmpeg for ${process.platform}/${process.arch}. Set FFMPEG_BIN to a local ffmpeg binary.`);
  const dest = ffmpegCachedBinary();
  const tmp = `${dest}.download`;
  await mkdir(path.dirname(dest), { recursive: true });
  await rm(tmp, { force: true });
  const expected = expectedSha256();
  const hash = createHash("sha256");
  try {
    const res = await getFollowing(url);
    res.on("data", (chunk: Buffer) => hash.update(chunk));
    if (onProgress) {
      const totalHeader = Number(res.headers["content-length"]);
      const total = Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : undefined;
      let downloaded = 0;
      res.on("data", (chunk: Buffer) => {
        downloaded += chunk.length;
        onProgress(downloaded, total);
      });
    }
    await pipeline(res, createGunzip(), createWriteStream(tmp));
  } catch (err) {
    throw withNetworkHint(err as Error);
  }
  if (expected) {
    const actual = hash.digest("hex");
    if (actual !== expected) {
      await rm(tmp, { force: true });
      throw new Error(
        `ffmpeg download failed integrity verification (sha256 ${actual}, expected ${expected}). ` +
          `The release asset may have changed upstream — do not use this binary. ` +
          `If you intentionally repointed the download, set FFMPEG_SHA256 to the new digest.`,
      );
    }
  }
  await chmod(tmp, 0o755).catch(() => {});
  await rm(dest, { force: true });
  await rename(tmp, dest);
  return dest;
}
