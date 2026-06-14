import { describe, expect, it } from "vitest";
import { annotationStateAt } from "@/generators/scroll-reel/annotations";

const anns = [
  { text: "Hello", atMs: 0, untilMs: 1000, position: "top" as const },
  { ring: "#cta", atMs: 500, untilMs: 1500 },
  { spotlight: "#hero", atMs: 1000 }, // open-ended → until clip end
];

describe("annotationStateAt", () => {
  it("activates only within the time window", () => {
    expect(annotationStateAt(anns, 200, 2000)).toEqual({
      caption: { text: "Hello", position: "top" },
    });
  });

  it("overlaps independent kinds", () => {
    const s = annotationStateAt(anns, 700, 2000);
    expect(s.caption?.text).toBe("Hello");
    expect(s.ringSelector).toBe("#cta");
    expect(s.spotlightSelector).toBeUndefined();
  });

  it("treats an omitted untilMs as the clip end", () => {
    const s = annotationStateAt(anns, 1800, 2000);
    expect(s.caption).toBeUndefined(); // ended at 1000
    expect(s.ringSelector).toBeUndefined(); // ended at 1500
    expect(s.spotlightSelector).toBe("#hero"); // open-ended, still active
  });

  it("is half-open: excludes exactly untilMs", () => {
    expect(annotationStateAt([{ text: "x", atMs: 0, untilMs: 1000 }], 1000, 2000).caption).toBeUndefined();
  });

  it("first active of each kind wins", () => {
    const s = annotationStateAt([{ text: "a" }, { text: "b" }], 0, 1000);
    expect(s.caption?.text).toBe("a");
  });
});
