import { describe, expect, it, vi } from "vitest";
import type { BrowserContext } from "playwright-core";
import { applyCapture, withCaptureQuery } from "@/pipeline/capture";
import { captureSettingsSchema, type ResolvedCaptureSettings } from "@/config/schema";

/** Resolve capture signals through the schema (defaults applied), as the pipeline does. */
const cap = (signals: Record<string, unknown> = {}): ResolvedCaptureSettings =>
  captureSettingsSchema.parse({ signals });

describe("withCaptureQuery", () => {
  it("appends query params to an absolute URL", () => {
    const out = withCaptureQuery("https://site.com/shop", cap({ query: { capture: "1" } }));
    expect(out).toBe("https://site.com/shop?capture=1");
  });

  it("merges with existing query and overwrites a clashing key", () => {
    const out = withCaptureQuery("https://site.com/?a=1&capture=0", cap({ query: { capture: "1" } }));
    expect(out).toBe("https://site.com/?a=1&capture=1");
  });

  it("returns the url unchanged when there is no query config", () => {
    expect(withCaptureQuery("https://site.com/", cap())).toBe("https://site.com/");
    expect(withCaptureQuery("https://site.com/", undefined)).toBe("https://site.com/");
  });

  it("leaves a non-absolute url alone (base-resolution happens elsewhere)", () => {
    expect(withCaptureQuery("/shop", cap({ query: { capture: "1" } }))).toBe("/shop");
  });

  it("passes undefined through", () => {
    expect(withCaptureQuery(undefined, cap({ query: { capture: "1" } }))).toBeUndefined();
  });
});

/** Minimal BrowserContext stub capturing the two methods applyCapture uses. */
function fakeContext(): {
  ctx: BrowserContext;
  addCookies: ReturnType<typeof vi.fn>;
  addInitScript: ReturnType<typeof vi.fn>;
} {
  const addCookies = vi.fn(async () => {});
  const addInitScript = vi.fn(async () => {});
  return { ctx: { addCookies, addInitScript } as unknown as BrowserContext, addCookies, addInitScript };
}

describe("applyCapture", () => {
  it("seeds cookies scoped to the asset origin", async () => {
    const { ctx, addCookies } = fakeContext();
    const capture: ResolvedCaptureSettings = cap({ cookies: [{ name: "pv-capture", value: "1" }] });
    await applyCapture(ctx, capture, "https://site.com/shop?capture=1");
    expect(addCookies).toHaveBeenCalledWith([
      { name: "pv-capture", value: "1", url: "https://site.com" },
    ]);
  });

  it("seeds localStorage + initScript via one init script", async () => {
    const { ctx, addInitScript } = fakeContext();
    await applyCapture(ctx, cap({ localStorage: { consent: "all" }, initScript: "window.x=1" }), "https://site.com/");
    expect(addInitScript).toHaveBeenCalledOnce();
    const script = addInitScript.mock.calls[0]![0] as string;
    expect(script).toContain("localStorage.setItem");
    expect(script).toContain("window.x=1");
  });

  it("is a no-op when capture is undefined", async () => {
    const { ctx, addCookies, addInitScript } = fakeContext();
    await applyCapture(ctx, undefined, "https://site.com/");
    expect(addCookies).not.toHaveBeenCalled();
    expect(addInitScript).not.toHaveBeenCalled();
  });

  it("skips cookies when the url is not absolute, without throwing", async () => {
    const { ctx, addCookies } = fakeContext();
    await applyCapture(ctx, cap({ cookies: [{ name: "a", value: "b" }] }), "/shop");
    expect(addCookies).not.toHaveBeenCalled();
  });
});
