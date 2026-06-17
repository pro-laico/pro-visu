import type { Browser } from "playwright-core";

export interface CardSpec {
  title?: string;
  subtitle?: string;
  background?: string;
  color?: string;
  durationMs?: number;
  fadeMs?: number;
}

/** Default intro/outro card length (ms). */
export const DEFAULT_CARD_DURATION_MS = 1500;
/** Default card fade in/out (ms). */
export const DEFAULT_CARD_FADE_MS = 400;

/** Pure: escape text for safe interpolation into the card HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Pure: the HTML document for a card at a given size. */
export function cardHtml(spec: CardSpec, width: number, height: number): string {
  const bg = spec.background ?? "#0b0b0f";
  const color = spec.color ?? "#ffffff";
  const titleSize = Math.round(height * 0.08);
  const subSize = Math.round(height * 0.038);
  const gap = Math.round(height * 0.03);
  const title = spec.title
    ? `<div style="font-size:${titleSize}px;font-weight:700;line-height:1.1">${escapeHtml(spec.title)}</div>`
    : "";
  const subtitle = spec.subtitle
    ? `<div style="font-size:${subSize}px;opacity:0.75;margin-top:${gap}px">${escapeHtml(spec.subtitle)}</div>`
    : "";
  return (
    `<!doctype html><html><head><meta charset="utf-8"></head>` +
    `<body style="margin:0;width:${width}px;height:${height}px;display:flex;flex-direction:column;` +
    `align-items:center;justify-content:center;background:${bg};color:${color};` +
    `font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;text-align:center;` +
    `padding:0 8%;box-sizing:border-box">${title}${subtitle}</body></html>`
  );
}

/** Render a card to a PNG via Playwright (HTML → PNG), supersampled by `scale`. */
export async function renderCard(
  browser: Browser,
  args: { spec: CardSpec; width: number; height: number; scale: number; outPath: string },
): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: args.scale,
  });
  try {
    const page = await context.newPage();
    await page.setContent(cardHtml(args.spec, args.width, args.height), { waitUntil: "load" });
    try {
      await page.evaluate(
        () =>
          (globalThis as { document?: { fonts?: { ready?: Promise<unknown> } } }).document?.fonts?.ready,
      );
    } catch {
      /* no font set */
    }
    await page.screenshot({ path: args.outPath, type: "png" });
  } finally {
    await context.close();
  }
}
