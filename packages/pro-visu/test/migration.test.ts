import { describe, expect, it } from "vitest";
import { legacyOptionHint } from "@/generators/migration";
import { scrollReelOptionsSchema } from "@/generators/scroll-reel/options";
import { screenshotsOptionsSchema } from "@/generators/screenshots/options";
import { wallOptionsSchema } from "@/generators/wall/options";
import { paletteReelOptionsSchema } from "@/generators/palette-reel/options";

/** Parse with the real schema and collect the hints a CLI error would carry. */
function hintsFor(generatorId: string, schema: { safeParse: (v: unknown) => any }, value: unknown): string[] {
  const parsed = schema.safeParse(value);
  expect(parsed.success).toBe(false);
  return parsed.error.issues
    .map((issue: never) => legacyOptionHint(generatorId, issue))
    .filter(Boolean) as string[];
}

describe("legacyOptionHint", () => {
  it("points a 0.4-era scroll-reel `duration` at `durationMs`", () => {
    const hints = hintsFor("scroll-reel", scrollReelOptionsSchema, { duration: 6000 });
    expect(hints.join(" ")).toContain('"durationMs"');
  });

  it("points old camelCase easing values at the kebab-case spelling", () => {
    const hints = hintsFor("scroll-reel", scrollReelOptionsSchema, { easing: "easeInOutCubic" });
    expect(hints.join(" ")).toContain('"ease-in-out-cubic"');
  });

  it("points screenshots `breakpoints` at `viewports`", () => {
    const hints = hintsFor("screenshots", screenshotsOptionsSchema, {
      breakpoints: [{ name: "desktop", width: 1440 }],
    });
    expect(hints.join(" ")).toContain('"viewports"');
  });

  it("flags the wall's seconds→ms unit change", () => {
    const hints = hintsFor("wall", wallOptionsSchema, {
      durationSeconds: 16,
      columns: [{ tiles: ["a"] }, { tiles: ["b"] }, { tiles: ["c"] }],
    });
    expect(hints.join(" ")).toContain("milliseconds");
  });

  it("covers all three renamed palette-reel timing options", () => {
    const hints = hintsFor("palette-reel", paletteReelOptionsSchema, {
      colors: [{ name: "ink", hex: "#141414" }],
      holdSeconds: 2,
      transitionSeconds: 0.7,
      durationSeconds: 10,
    });
    const joined = hints.join(" ");
    expect(joined).toContain('"holdMs"');
    expect(joined).toContain('"transitionMs"');
    expect(joined).toContain('"durationMs"');
  });

  it("stays silent for plain typos that aren't known renames", () => {
    const hints = hintsFor("scroll-reel", scrollReelOptionsSchema, { widht: 100 });
    expect(hints).toHaveLength(0);
  });
});
