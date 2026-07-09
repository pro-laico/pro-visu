import type { ShowcaseSettingsInput } from "pro-visu";

// Serial: the frame-stepped wall is memory-heavy, so run one asset at a time. (Heavy wall plans
// get a bigger Node heap automatically — no memory knob needed.)
export const settings: ShowcaseSettingsInput = {
  outDir: "../public/pro-visu/showcase", // relative to pro-visu/ config dir → served by the Next app at /pro-visu/showcase/* (and /gallery)
  concurrency: 1,
  browser: { headless: true },
  server: {
    build: "pnpm build",
    command: "pnpm exec next start",
    port: 3400, // pinned off the shared 3000 dev port; the start script uses 3400 too
    readyTimeoutMs: 180_000,
  },
  defaults: {
    "scroll-reel": { output: { width: 1280, height: 800, fps: 30 } },
    // The storefront's sticky header is ~100px tall; top-aligned scrollTo drops targets below it.
    interaction: { page: { stickyHeaderHeight: 100 } },
  },
};
