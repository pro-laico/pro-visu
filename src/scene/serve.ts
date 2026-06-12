import http from "node:http";
import path from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
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
  ".map": "application/json",
};

const mimeFor = (p: string): string =>
  MIME[path.extname(p).toLowerCase()] ?? "application/octet-stream";

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
  const staticRoot = path.resolve(args.staticDir);
  const inputByUrl = new Map<string, string>();
  const slotToUrl = new Map<string, string>();
  for (const [slot, file] of Object.entries(args.inputs)) {
    const ext = path.extname(file) || ".mp4";
    const url = `/_inputs/${slot}${ext}`;
    inputByUrl.set(url, file);
    slotToUrl.set(slot, url);
  }

  const serveFile = async (
    file: string,
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> => {
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

    const range = rangeable ? req.headers.range : undefined;
    if (range) {
      const m = /bytes=(\d+)-(\d*)/.exec(range);
      const start = m ? Number(m[1]) : 0;
      const end = m && m[2] ? Number(m[2]) : info.size - 1;
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${info.size}`,
        "Content-Length": end - start + 1,
      });
      createReadStream(file, { start, end }).pipe(res);
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
      // SPA fallback so the scene app always loads.
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
    inputUrl: (slot) => origin + (slotToUrl.get(slot) ?? ""),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
