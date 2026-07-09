import type { ShowcaseSettingsInput } from "pro-visu";

export const settings: ShowcaseSettingsInput = {
  outDir: "../public/pro-visu/showcase",
  concurrency: 1,
  browser: { headless: true },
  server: { build: "pnpm build", command: "pnpm exec next start", port: 3400, readyTimeoutMs: 180_000 },
  defaults: { "scroll-reel": { output: { width: 1280, height: 800, fps: 30 } }, interaction: { page: { stickyHeaderHeight: 100 } } },
};
