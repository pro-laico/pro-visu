import { describe, expect, it } from "vitest";

import { createLogger } from "@/utils/logger";
import { showcaseConfigSchema, type ResolvedConfig } from "@/config/schema";
import { preflightUrls, validatePlan } from "@/cli/commands/generate";

const log = createLogger("silent");

function config(raw: Record<string, unknown>): ResolvedConfig {
  return showcaseConfigSchema.parse(raw);
}

describe("validatePlan", () => {
  it("passes a well-formed plan", () => {
    const cfg = config({ assets: [{ name: "home", generator: "scroll-reel", url: "https://example.com" }] });
    expect(validatePlan(log, cfg, cfg.assets, "final")).toBe(true);
  });

  it("fails on an unknown generator", () => {
    const cfg = config({ assets: [{ name: "home", generator: "scrol-reel", url: "https://example.com" }] });
    expect(validatePlan(log, cfg, cfg.assets, "final")).toBe(false);
  });

  it("fails when merged options don't parse", () => {
    const cfg = config({
      assets: [{ name: "home", generator: "scroll-reel", url: "https://example.com", options: { output: { fps: "fast" } } }],
    });
    expect(validatePlan(log, cfg, cfg.assets, "final")).toBe(false);
  });

  it("applies settings.defaults underneath asset options before validating", () => {
    const cfg = config({
      settings: { defaults: { "scroll-reel": { output: { fps: "fast" } } } },
      assets: [{ name: "home", generator: "scroll-reel", url: "https://example.com" }],
    });
    expect(validatePlan(log, cfg, cfg.assets, "final")).toBe(false);
  });
});

describe("preflightUrls", () => {
  it("fails fast on a url-based asset with no url", async () => {
    const cfg = config({ assets: [{ name: "home", generator: "scroll-reel" }] });
    expect(await preflightUrls(log, cfg, cfg.assets)).toBe(false);
  });

  it("fails fast on a relative url with no managed server", async () => {
    const cfg = config({ assets: [{ name: "home", generator: "scroll-reel", url: "/shop" }] });
    expect(await preflightUrls(log, cfg, cfg.assets)).toBe(false);
  });

  it("reports a malformed absolute url as a plan error instead of probing it", async () => {
    const cfg = config({ assets: [{ name: "home", generator: "scroll-reel", url: "http://" }] });
    expect(await preflightUrls(log, cfg, cfg.assets)).toBe(false);
  });

  it("ignores assets whose generator needs no url", async () => {
    const cfg = config({ assets: [{ name: "colors", generator: "palette", options: { colors: [{ hex: "#102030" }] } }] });
    expect(await preflightUrls(log, cfg, cfg.assets)).toBe(true);
  });
});
