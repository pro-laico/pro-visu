import { describe, expect, it } from "vitest";
import { closestMatch, didYouMean } from "@/utils/suggest";

const GENERATORS = ["scroll-reel", "screenshots", "wall", "specimen", "palette", "palette-reel", "image"];

describe("closestMatch", () => {
  it("finds the nearest candidate for a small typo", () => {
    expect(closestMatch("scrollreel", GENERATORS)).toBe("scroll-reel");
    expect(closestMatch("screenshot", GENERATORS)).toBe("screenshots");
    expect(closestMatch("Wall", GENERATORS)).toBe("wall");
  });

  it("returns undefined when nothing is plausibly a typo", () => {
    expect(closestMatch("video", GENERATORS)).toBeUndefined();
    expect(closestMatch("zzzzzzzz", GENERATORS)).toBeUndefined();
  });

  it("handles empty candidate lists", () => {
    expect(closestMatch("anything", [])).toBeUndefined();
  });
});

describe("didYouMean", () => {
  it("formats a hint when there's a plausible match, and stays silent otherwise", () => {
    expect(didYouMean("scrollreel", GENERATORS)).toBe(' (did you mean "scroll-reel"?)');
    expect(didYouMean("completely-unrelated-thing", GENERATORS)).toBe("");
  });
});
