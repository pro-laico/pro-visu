import { describe, expect, it } from "vitest";
import type { ZodIssue } from "zod";
import { legacyGeneratorHint, legacyOptionHint } from "@/generators/migration";
import { scrollReelOptionsSchema } from "@/generators/scroll-reel/options";
import { wallOptionsSchema } from "@/generators/wall/options";

/** Build the unrecognized_keys issue shape zod emits for a strict schema. */
function unrecognized(keys: string[]): ZodIssue {
  return { code: "unrecognized_keys", keys, path: [], message: "Unrecognized key(s)" } as ZodIssue;
}

describe("legacyOptionHint", () => {
  it("points moved clean-capture options at settings.capture", () => {
    for (const key of ["hideSelectors", "blockTrackers", "freezeClock", "injectCss"]) {
      const hint = legacyOptionHint("scroll-reel", unrecognized([key]));
      expect(hint).toContain(key);
      expect(hint).toContain("settings.capture");
    }
  });

  it("points actions/cursor/focus at the interaction generator", () => {
    const hint = legacyOptionHint("scroll-reel", unrecognized(["actions", "cursor", "focus"]));
    expect(hint).toContain('"interaction" generator');
  });

  it("flags removed scroll-reel extras as removed", () => {
    for (const key of ["kenBurns", "annotations", "intro", "outro", "routes"]) {
      expect(legacyOptionHint("scroll-reel", unrecognized([key]))).toContain("removed");
    }
  });

  it("points the removed capture strategy at the interaction generator", () => {
    const hint = legacyOptionHint("scroll-reel", unrecognized(["capture"]));
    expect(hint).toContain("frame-stepped");
    expect(hint).toContain('"interaction" generator');
  });

  it("joins hints for multiple offending keys", () => {
    const hint = legacyOptionHint("scroll-reel", unrecognized(["kenBurns", "hideSelectors"]));
    expect(hint).toContain("kenBurns");
    expect(hint).toContain("hideSelectors");
    expect(hint).toContain("; ");
  });

  it("flags the wall faux-tile size→caption rename", () => {
    expect(legacyOptionHint("wall", unrecognized(["size"]))).toContain('"caption"');
  });

  it("points pre-unification easing names at their canonical replacement", () => {
    const issue = {
      code: "invalid_enum_value",
      received: "ease-in-out-cubic",
      options: ["linear", "ease-in", "ease-out", "ease-in-out", "ease-out-strong", "ease-in-out-strong"],
      path: ["easing"],
      message: "Invalid enum value",
    } as ZodIssue;
    expect(legacyOptionHint("scroll-reel", issue)).toContain('"ease-in-out"');
  });

  it("returns undefined for keys with no migration story", () => {
    expect(legacyOptionHint("scroll-reel", unrecognized(["definitelyNotAThing"]))).toBeUndefined();
    expect(legacyOptionHint("specimen", unrecognized(["kenBurns"]))).toBeUndefined();
  });

  it("fires on the real schemas (end to end through safeParse)", () => {
    const reel = scrollReelOptionsSchema.safeParse({ kenBurns: { scaleTo: 1.1 } });
    expect(reel.success).toBe(false);
    if (!reel.success) {
      const hints = reel.error.issues.map((i) => legacyOptionHint("scroll-reel", i)).filter(Boolean);
      expect(hints.join(" ")).toContain("kenBurns");
    }

    const wall = wallOptionsSchema.safeParse({
      columns: [{ tiles: ["a"] }, { tiles: ["b"] }, { tiles: ["c"] }],
      preview: { tiles: { a: { size: "16:9" } } },
    });
    expect(wall.success).toBe(false);
    if (!wall.success) {
      const hints = wall.error.issues.map((i) => legacyOptionHint("wall", i)).filter(Boolean);
      expect(hints.join(" ")).toContain('"caption"');
    }
  });
});

describe("legacyGeneratorHint", () => {
  it("explains the removed image generator", () => {
    expect(legacyGeneratorHint("image")).toContain("{ src:");
  });
  it("returns undefined for anything else", () => {
    expect(legacyGeneratorHint("scroll-reel")).toBeUndefined();
    expect(legacyGeneratorHint("nope")).toBeUndefined();
  });
});
