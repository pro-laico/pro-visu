import { describe, expect, it } from "vitest";
import { generatorIds, getGenerator } from "@/generators/registry";
import { SCROLL_REEL_ID } from "@/generators/scroll-reel";

describe("generator registry", () => {
  it("registers the scroll-reel generator", () => {
    expect(generatorIds()).toContain(SCROLL_REEL_ID);
    expect(getGenerator(SCROLL_REEL_ID)?.id).toBe(SCROLL_REEL_ID);
  });

  it("returns undefined for unknown generators", () => {
    expect(getGenerator("does-not-exist")).toBeUndefined();
  });
});
