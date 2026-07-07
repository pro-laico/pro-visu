import type { ShowcaseSettingsInput } from "pro-visu";

// Serial: the frame-stepped wall is memory-heavy, so run one asset at a time. (Heavy wall plans
// get a bigger Node heap automatically — no memory knob needed.)
export const settings = {
  outDir: "public/pro-visu", // served by the Next app at /pro-visu/* (and /gallery)
  concurrency: 1,
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
} satisfies ShowcaseSettingsInput;
