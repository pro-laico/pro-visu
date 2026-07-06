import { defineSettings } from "pro-visu";

// Serial + a roomy Node heap: the frame-stepped wall is memory-heavy, so run one asset at a
// time and raise the heap past Node's ~4 GB default.
export const settings = defineSettings({
  outDir: "public/pro-visu", // served by the Next app at /pro-visu/* (and /gallery)
  concurrency: 1,
  maxMemoryMB: 8192,
  browser: { headless: true },
  server: {
    build: "pnpm build",
    command: "pnpm exec next start",
    port: 3400, // pinned off the shared 3000 dev port; the start script uses 3400 too
    readyTimeoutMs: 180_000,
  },
  defaults: {
    "scroll-reel": { width: 1280, height: 800, fps: 30 },
  },
});
