// Standalone ESM runner spawned by the device-frame generator. Kept out of the main
// process so Revideo's heavy stack (vite, puppeteer) only loads when actually rendering,
// and so its working directory can't race with concurrent generators.
//
// The captured input video is served over an ephemeral localhost server (Revideo's <Video>
// loads it by URL) — robust across package layouts, no writes into node_modules.
//
// Configured via env:
//   RV_INPUT     absolute path to the input mp4 (served at /input.mp4)
//   RV_PROJECT   project file relative to cwd (the revideo/ dir) — default ./project.ts
//   RV_OUTDIR    absolute output directory
//   RV_OUTFILE   output filename (.mp4)
//   RV_FFMPEG    path to an ffmpeg binary
//   RV_VARS      JSON of extra scene variables (background, videoWidth, durationSeconds)
//   PUPPETEER_EXECUTABLE_PATH  Chromium to render with
import http from "node:http";
import path from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { renderVideo } from "@revideo/renderer";

const inputFile = process.env.RV_INPUT ?? "";
// Keep RELATIVE: Revideo feeds projectFile to Vite as an import specifier; an absolute
// Windows path gets its backslashes mangled. cwd is always the revideo project dir.
const projectFile = process.env.RV_PROJECT ?? "./project.ts";

// Revideo draws the video onto a canvas, so it loads it cross-origin with `crossOrigin`.
// Serve permissive CORS headers or the browser rejects it (MEDIA_ERR_SRC_NOT_SUPPORTED).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Range",
  "Access-Control-Expose-Headers": "Accept-Ranges, Content-Range, Content-Length",
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  let info;
  try {
    info = await stat(inputFile);
  } catch {
    res.statusCode = 404;
    res.end();
    return;
  }
  const base = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", ...cors };
  if (req.method === "HEAD") {
    res.writeHead(200, { ...base, "Content-Length": info.size });
    res.end();
    return;
  }
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? Number(m[1]) : 0;
    const end = m && m[2] ? Number(m[2]) : info.size - 1;
    res.writeHead(206, {
      ...base,
      "Content-Range": `bytes ${start}-${end}/${info.size}`,
      "Content-Length": end - start + 1,
    });
    createReadStream(inputFile, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...base, "Content-Length": info.size });
    createReadStream(inputFile).pipe(res);
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const videoSrc = `http://127.0.0.1:${port}/input.mp4`;

try {
  const out = await renderVideo({
    projectFile,
    variables: { ...JSON.parse(process.env.RV_VARS ?? "{}"), videoSrc },
    settings: {
      outFile: process.env.RV_OUTFILE ?? "framed.mp4",
      outDir: process.env.RV_OUTDIR ?? "./output",
      logProgress: true,
      ffmpeg: process.env.RV_FFMPEG ? { ffmpegPath: process.env.RV_FFMPEG } : undefined,
    },
  });
  const abs = path.isAbsolute(out) ? out : path.resolve(process.cwd(), out);
  process.stdout.write(`OUT:${abs}\n`);
} finally {
  server.close();
}
