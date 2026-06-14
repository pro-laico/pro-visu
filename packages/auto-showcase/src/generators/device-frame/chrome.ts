import path from "node:path";
import { writeFile } from "node:fs/promises";
import type { Browser } from "playwright-core";
import type { Logger } from "@/utils/logger";
import { ensureDir } from "@/utils/fs";

/** Fixed browser-chrome styling (CSS px). Mirrors the old Revideo scene's look. */
const TITLE_BAR = 52;
const BORDER = 2;
const WINDOW_RADIUS = 24;
const VIEWPORT_RADIUS = 22;
const PADDING = 96;

export interface RenderChromeArgs {
  browser: Browser;
  outDir: string;
  /** Captured video pixel dimensions (drives the viewport aspect ratio). */
  videoWidth: number;
  videoHeight: number;
  /** Window viewport width in CSS px (the `frameWidth` option). */
  frameWidth: number;
  /** Backdrop color behind the window. */
  background: string;
  /** Render scale (2 = retina-crisp). */
  scale: number;
  logger: Logger;
}

export interface ChromeResult {
  /** Full-frame PNG: opaque window on a transparent surround (overlaid at 0,0). */
  framePng: string;
  /** White rounded-bottom rect on transparent — alpha mask for the video corners. */
  maskPng: string;
  /** Output frame size in device px (even, for yuv420p). */
  frameWidthPx: number;
  frameHeightPx: number;
  /**
   * Where the video goes, in device px, relative to the full frame. w/h are plain-rounded (not
   * even-rounded) so they exactly match the mask PNG's natural pixel size — the composite then
   * scales the mask to w×h as a no-op, keeping the baked corner radius crisp and the video's aspect
   * undistorted. (Only the final frame needs even dimensions; this masked overlay is an intermediate.)
   */
  viewport: { x: number; y: number; w: number; h: number };
}

const evenRound = (n: number) => {
  const r = Math.round(n);
  return r % 2 === 0 ? r : r + 1;
};

/**
 * Render the static window chrome to PNGs using the (already-running) Playwright browser.
 * Because the decoration never animates, we paint it once and let ffmpeg overlay the moving
 * capture into the viewport — no per-frame browser rendering.
 */
export async function renderChrome(args: RenderChromeArgs): Promise<ChromeResult> {
  const { browser, outDir, videoWidth, videoHeight, frameWidth, background, scale } = args;
  await ensureDir(outDir);

  const vpW = frameWidth;
  const vpH = Math.round((frameWidth * videoHeight) / videoWidth);
  const frameCssW = vpW + 2 * BORDER + 2 * PADDING;
  const frameCssH = TITLE_BAR + vpH + 2 * BORDER + 2 * PADDING;

  const frameHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent}
.frame{width:${frameCssW}px;height:${frameCssH}px;display:flex;align-items:center;justify-content:center}
.window{background:#1b1b22;border:${BORDER}px solid #2c2c36;border-radius:${WINDOW_RADIUS}px;overflow:hidden;display:flex;flex-direction:column}
.titlebar{height:${TITLE_BAR}px;background:#23232c;display:flex;align-items:center;padding-left:22px;gap:12px}
.dot{width:15px;height:15px;border-radius:50%}
.viewport{width:${vpW}px;height:${vpH}px;background:#1b1b22}
</style></head><body><div class="frame"><div class="window">
<div class="titlebar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span></div>
<div class="viewport" id="vp"></div>
</div></div></body></html>`;

  const maskHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent}
.mask{width:${vpW}px;height:${vpH}px;background:#fff;border-radius:0 0 ${VIEWPORT_RADIUS}px ${VIEWPORT_RADIUS}px}
</style></head><body><div class="mask"></div></body></html>`;

  const context = await browser.newContext({
    viewport: { width: frameCssW, height: frameCssH },
    deviceScaleFactor: scale,
  });
  try {
    const page = await context.newPage();

    await page.setContent(frameHtml, { waitUntil: "load" });
    const vp = await page.locator("#vp").boundingBox();
    if (!vp) throw new Error("device-frame: could not measure the viewport element.");
    const framePng = path.join(outDir, "chrome-frame.png");
    await writeFile(framePng, await page.screenshot({ omitBackground: true, type: "png" }));

    await page.setViewportSize({ width: vpW, height: vpH });
    await page.setContent(maskHtml, { waitUntil: "load" });
    const maskPng = path.join(outDir, "chrome-mask.png");
    await writeFile(maskPng, await page.screenshot({ omitBackground: true, type: "png" }));

    return {
      framePng,
      maskPng,
      frameWidthPx: evenRound(frameCssW * scale),
      frameHeightPx: evenRound(frameCssH * scale),
      viewport: {
        x: Math.round(vp.x * scale),
        y: Math.round(vp.y * scale),
        // Plain round (not even): matches the mask's native pixel size exactly, so the composite's
        // scale-to-w×h is a no-op — no corner-radius stretch, no aspect distortion.
        w: Math.round(vp.width * scale),
        h: Math.round(vp.height * scale),
      },
    };
  } finally {
    await context.close();
  }
}
