import http from "node:http";
import path from "node:path";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

const mimeFor = (p: string): string =>
  MIME[path.extname(p).toLowerCase()] ?? "application/octet-stream";

/**
 * Parse a single HTTP byte-range header against a known size. Handles `bytes=start-end`,
 * `bytes=start-` (open-ended), and `bytes=-N` (suffix: the last N bytes — which Chromium's media
 * stack does issue). Returns null for absent/malformed/unsatisfiable/multi ranges, in which case the
 * caller should serve the full body (200) rather than mis-claim a 206. Pure — unit-tested.
 */
export function parseByteRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, startRaw, endRaw] = m;
  let start: number;
  let end: number;
  if (startRaw === "") {
    if (endRaw === "") return null;
    const n = Number(endRaw);
    if (!(n > 0)) return null;
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(startRaw);
    end = endRaw === "" ? size - 1 : Number(endRaw);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  end = Math.min(end, size - 1);
  if (start < 0 || start > end || start >= size) return null;
  return { start, end };
}

export interface SceneServer {
  origin: string;
  /** Absolute URL of a served input asset by slot name. */
  inputUrl(slot: string): string;
  close(): Promise<void>;
}

export interface SceneServerArgs {
  /** Directory of the built scene app (served at "/"). */
  staticDir: string;
  /** Slot name → absolute input file path, served under /_inputs/. */
  inputs: Record<string, string>;
}

/**
 * Ephemeral static server for one scene render: serves the built scene app plus this asset's
 * input files (with HTTP range support so the scene's <video> can seek). No writes anywhere.
 */
export async function startSceneServer(args: SceneServerArgs): Promise<SceneServer> {
  const slotToUrl = new Map<string, string>();
  const inputByUrl = new Map<string, string>();
  const staticRoot = path.resolve(args.staticDir);
  for (const [slot, file] of Object.entries(args.inputs)) {
    const ext = path.extname(file) || ".mp4";
    const url = `/_inputs/${slot}${ext}`;
    inputByUrl.set(url, file);
    slotToUrl.set(slot, url);
  }

  const serveFile = async (file: string, req: IncomingMessage, res: ServerResponse): Promise<void> => {
    let info;
    try {
      info = await stat(file);
    } catch {
      res.statusCode = 404;
      res.end();
      return;
    }
    if (info.isDirectory()) return serveFile(path.join(file, "index.html"), req, res);

    const type = mimeFor(file);
    const rangeable = type.startsWith("video/");
    if (rangeable) res.setHeader("Accept-Ranges", "bytes");

    const parsed = rangeable ? parseByteRange(req.headers.range, info.size) : null;
    if (parsed) {
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Range": `bytes ${parsed.start}-${parsed.end}/${info.size}`,
        "Content-Length": parsed.end - parsed.start + 1,
      });
      createReadStream(file, { start: parsed.start, end: parsed.end }).pipe(res);
    } else {
      res.writeHead(200, { "Content-Type": type, "Content-Length": info.size });
      createReadStream(file).pipe(res);
    }
  };

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");

    const inputFile = inputByUrl.get(urlPath);
    if (inputFile) return serveFile(inputFile, req, res);

    const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
    const filePath = path.resolve(staticRoot, rel);
    if (filePath !== staticRoot && !filePath.startsWith(staticRoot + path.sep)) {
      res.statusCode = 403;
      res.end();
      return;
    }
    try {
      await stat(filePath);
      return serveFile(filePath, req, res);
    } catch {
      return serveFile(path.join(staticRoot, "index.html"), req, res);
    }
  };

  const server = http.createServer((req, res) => {
    void handle(req, res).catch(() => {
      res.statusCode = 500;
      res.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const origin = `http://127.0.0.1:${port}`;

  return {
    origin,
    inputUrl: (slot) => {
      const rel = slotToUrl.get(slot);
      if (!rel) throw new Error(`Unknown scene input slot "${slot}".`);
      return origin + rel;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
