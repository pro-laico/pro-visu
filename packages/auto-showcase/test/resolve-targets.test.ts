import { describe, expect, it } from "vitest";
import { resolveTargets } from "@/config/resolve-targets";
import type { ResolvedAssetSpec } from "@/config/schema";

function asset(over: Partial<ResolvedAssetSpec> = {}): ResolvedAssetSpec {
  return { name: "a", generator: "scroll-reel", options: {}, inputs: {}, ...over };
}
const needsUrl = (id: string) =>
  id === "scroll-reel" || id === "screenshots" || id === "device-frame";
const BASE = "http://127.0.0.1:3101";

describe("resolveTargets", () => {
  it("returns the same array unchanged when there is no managed-server base", () => {
    const assets = [asset({ url: "/shop" })];
    expect(resolveTargets(assets, undefined, needsUrl)).toBe(assets);
  });

  it("defaults an omitted url to the base for url-based generators", () => {
    const a = resolveTargets([asset({ generator: "screenshots" })], BASE, needsUrl)[0]!;
    expect(a.url).toBe(BASE);
  });

  it("leaves url undefined for generators that don't need one", () => {
    const a = resolveTargets([asset({ generator: "palette" })], BASE, needsUrl)[0]!;
    expect(a.url).toBeUndefined();
  });

  it("resolves a relative url against the base", () => {
    const a = resolveTargets([asset({ url: "/shop" })], BASE, needsUrl)[0]!;
    expect(a.url).toBe("http://127.0.0.1:3101/shop");
  });

  it("leaves an absolute url untouched, even to another host", () => {
    const a = resolveTargets([asset({ url: "https://example.com/x" })], BASE, needsUrl)[0]!;
    expect(a.url).toBe("https://example.com/x");
  });

  it("resolves relative routes (string and object forms), passing absolutes through", () => {
    const a = resolveTargets(
      [
        asset({
          options: { routes: ["/", "/shop", { url: "/about", durationMs: 5 }, "https://x.com/y"] },
        }),
      ],
      BASE,
      needsUrl,
    )[0]!;
    expect(a.options.routes).toEqual([
      "http://127.0.0.1:3101/",
      "http://127.0.0.1:3101/shop",
      { url: "http://127.0.0.1:3101/about", durationMs: 5 },
      "https://x.com/y",
    ]);
  });

  it("does not mutate the input asset or its options", () => {
    const original = asset({ url: "/shop", options: { routes: ["/x"] } });
    resolveTargets([original], BASE, needsUrl);
    expect(original.url).toBe("/shop");
    expect(original.options.routes).toEqual(["/x"]);
  });
});
