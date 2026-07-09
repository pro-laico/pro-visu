import { describe, expect, it } from "vitest";
import { captureSettingsSchema, captureOverrideSchema, assetSpecSchema } from "@/config/schema";
import { resolveAssetCapture } from "@/pipeline/capture";

const global = (raw: unknown) => captureSettingsSchema.parse(raw);
const override = (raw: unknown) => captureOverrideSchema.parse(raw);

describe("resolveAssetCapture", () => {
  it("returns the global unchanged when there is no override", () => {
    const g = global({ cleanup: { hideSelectors: ["#a"] } });
    expect(resolveAssetCapture(g, undefined)).toBe(g); // same reference → no cache churn
  });

  it("showSelectors un-hides one globally-hidden element while keeping the rest", () => {
    const g = global({ cleanup: { hideSelectors: ["#cookie-banner", "#chat"] } });
    const o = override({ cleanup: { showSelectors: ["#cookie-banner"] } });
    expect(resolveAssetCapture(g, o).cleanup.hideSelectors).toEqual(["#chat"]);
  });

  it("hideSelectors is additive (unioned with the globals, de-duped)", () => {
    const g = global({ cleanup: { hideSelectors: ["#chat"] } });
    const o = override({ cleanup: { hideSelectors: ["#promo", "#chat"] } });
    expect(resolveAssetCapture(g, o).cleanup.hideSelectors).toEqual(["#chat", "#promo"]);
  });

  it("booleans override the global (omit to inherit)", () => {
    const g = global({ cleanup: { freezeClock: true, blockTrackers: true } });
    const o = override({ cleanup: { freezeClock: false } });
    const r = resolveAssetCapture(g, o).cleanup;
    expect(r.freezeClock).toBe(false); // overridden
    expect(r.blockTrackers).toBe(true); // inherited
  });

  it("blockHosts unions and unblockHosts subtracts", () => {
    const g = global({ cleanup: { blockHosts: ["ads.example", "track.example"] } });
    const o = override({ cleanup: { blockHosts: ["extra.example"], unblockHosts: ["track.example"] } });
    expect(resolveAssetCapture(g, o).cleanup.blockHosts).toEqual(["ads.example", "extra.example"]);
  });

  it("injectCss is appended, not replaced", () => {
    const g = global({ cleanup: { injectCss: ".g{}" } });
    const o = override({ cleanup: { injectCss: ".a{}" } });
    expect(resolveAssetCapture(g, o).cleanup.injectCss).toBe(".g{}\n.a{}");
  });

  it("signals: query records merge and cookies merge by name (override wins)", () => {
    const g = global({ signals: { query: { capture: "1" }, cookies: [{ name: "sid", value: "old" }] } });
    const o = override({ signals: { query: { theme: "dark" }, cookies: [{ name: "sid", value: "new" }] } });
    const r = resolveAssetCapture(g, o).signals;
    expect(r.query).toEqual({ capture: "1", theme: "dark" });
    expect(r.cookies).toEqual([{ name: "sid", value: "new" }]);
  });
});

describe("asset capture override schema", () => {
  it("accepts a capture override on an asset", () => {
    const asset = assetSpecSchema.parse({
      name: "hero",
      generator: "scroll-reel",
      capture: { cleanup: { showSelectors: ["#cookie-banner"] } },
    });
    expect(asset.capture?.cleanup?.showSelectors).toEqual(["#cookie-banner"]);
  });

  it("rejects unknown keys in a capture override (strict)", () => {
    expect(() =>
      assetSpecSchema.parse({ name: "x", generator: "scroll-reel", capture: { cleanup: { nope: true } } }),
    ).toThrow();
  });
});
