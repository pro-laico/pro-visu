import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import type { Browser } from "playwright-core";
import { ensureDir } from "@/utils/fs";
import type { Logger } from "@/utils/logger";

export interface RecordSceneArgs {
  browser: Browser;
  url: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  durationSeconds: number;
  tmpDir: string;
  logger: Logger;
}

/**
 * Realtime capture: load the scene, wait until its videos are ready, play them, and record
 * the page for `durationSeconds` via Playwright's native recorder. Real-time (wall-clock) —
 * simple, but not frame-accurate; the deterministic frame-stepper is the precise path.
 * Returns the recorded .webm path.
 */
export async function recordSceneRealtime(args: RecordSceneArgs): Promise<string> {
  await ensureDir(args.tmpDir);
  const recordDir = await mkdtemp(path.join(args.tmpDir, "scene-rec-"));

  const context = await args.browser.newContext({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: args.deviceScaleFactor,
    recordVideo: { dir: recordDir, size: { width: args.width, height: args.height } },
  });
  const page = await context.newPage();
  const video = page.video();
  page.on("console", (m) => args.logger.debug(`[scene] ${m.text()}`));
  page.on("pageerror", (e) => args.logger.debug(`[scene error] ${e.message}`));

  try {
    args.logger.debug(`loading scene ${args.url}`);
    await page.goto(args.url, { waitUntil: "load" });
    try {
      await page.waitForFunction(
        () => (globalThis as { __showcaseReady?: boolean }).__showcaseReady === true,
        undefined,
        { timeout: 30_000 },
      );
    } catch (err) {
      const diag = await page
        .evaluate(() => {
          // Runs in the browser; the node tsconfig has no DOM lib, so reach via globalThis.
          const g = globalThis as unknown as {
            __showcase?: unknown;
            document: { querySelectorAll(s: string): ArrayLike<Record<string, unknown>> };
          };
          const vids = Array.from(g.document.querySelectorAll("video"));
          return {
            hasRuntime: Boolean(g.__showcase),
            videoCount: vids.length,
            videos: vids.map((v) => ({
              src: v.currentSrc || v.src,
              readyState: v.readyState,
              networkState: v.networkState,
              error: (v.error as { code?: number } | null)?.code ?? null,
            })),
          };
        })
        .catch(() => null);
      args.logger.error(`scene never became ready: ${JSON.stringify(diag)}`);
      throw err;
    }
    await page.evaluate(() =>
      (globalThis as { __showcase?: { play(): void } }).__showcase?.play(),
    );
    await page.waitForTimeout(Math.round(args.durationSeconds * 1000));
  } finally {
    await context.close(); // finalizes the webm
  }

  if (!video) throw new Error("Playwright did not record a scene video.");
  return await video.path();
}
