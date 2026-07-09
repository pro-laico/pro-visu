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

/** The recorded .webm plus the lead time (seconds) of blank navigation/readiness before play()
 *  started — Playwright records the whole context lifetime, so the caller trims this off the front. */
export interface RecordSceneResult {
  path: string;
  leadSeconds: number;
}

/**
 * Realtime capture: load the scene, wait until it's ready (fonts loaded and the scene has painted
 * its first frame), play it, and record the page for `durationSeconds` via Playwright's native
 * recorder. Real-time (wall-clock) — simple, but not frame-accurate; the deterministic frame-stepper
 * is the precise path. Playwright records from context creation, so we also return `leadSeconds` (the
 * blank navigation/readiness span before play()) for the caller to trim off the recording's head.
 */
export async function recordSceneRealtime(args: RecordSceneArgs): Promise<RecordSceneResult> {
  await ensureDir(args.tmpDir);
  const recordDir = await mkdtemp(path.join(args.tmpDir, "scene-rec-"));

  const recStart = Date.now();
  const context = await args.browser.newContext({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: args.deviceScaleFactor,
    recordVideo: { dir: recordDir, size: { width: args.width, height: args.height } },
  });
  const page = await context.newPage();
  const video = page.video();
  page.on("console", (m) => args.logger.debug(`[scene] ${m.text()}`));
  page.on("pageerror", (e) => args.logger.debug(`[scene error] ${e.message}`));

  let leadSeconds = 0;
  try {
    args.logger.debug(`loading scene ${args.url}`);
    await page.goto(args.url, { waitUntil: "load" });
    try {
      //TODO: replace `as` cast with proper typing
      await page.waitForFunction(
        () => (globalThis as { __showcaseReady?: boolean }).__showcaseReady === true,
        undefined,
        { timeout: 30_000 },
      );
    } catch (err) {
      //TODO: replace `as unknown as` cast with proper typing
      const diag = await page
        .evaluate(() => {
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
              error: (v.error as { code?: number } | null)?.code ?? null, //TODO: replace `as` cast with proper typing
            })),
          };
        })
        .catch(() => null);
      args.logger.error(`scene never became ready: ${JSON.stringify(diag)}`);
      throw err;
    }
    leadSeconds = (Date.now() - recStart) / 1000;
    //TODO: replace `as` cast with proper typing
    await page.evaluate(() => (globalThis as { __showcase?: { play(): void } }).__showcase?.play());
    await page.waitForTimeout(Math.round(args.durationSeconds * 1000));
  } finally {
    await context.close();
  }

  if (!video) throw new Error("Playwright did not record a scene video.");
  return { path: await video.path(), leadSeconds };
}
