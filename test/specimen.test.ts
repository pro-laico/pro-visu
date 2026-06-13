import { describe, expect, it } from "vitest";
import { specimenOptionsSchema } from "@/generators/specimen/options";
import { generatorIds, getGenerator } from "@/generators/registry";
import { SPECIMEN_ID } from "@/generators/specimen";

describe("specimen generator", () => {
  it("is registered", () => {
    expect(generatorIds()).toContain(SPECIMEN_ID);
    expect(getGenerator(SPECIMEN_ID)?.id).toBe(SPECIMEN_ID);
  });

  it("exposes frame size, leading, pool, and seed knobs with defaults", () => {
    const o = specimenOptionsSchema.parse({ font: "x.woff2" });
    expect(o.width).toBe(1920);
    expect(o.height).toBe(1080);
    expect(o.leading).toBe(0.78);
    expect(o.seed).toBe(1);
    expect(o.characterPool).toBeUndefined(); // falls back to the master pool at render

    const custom = specimenOptionsSchema.parse({
      font: "x.woff2",
      width: 1080,
      height: 1350,
      leading: 0.9,
      seed: 99,
      characterPool: "ABCDEF",
    });
    expect([custom.width, custom.height, custom.leading, custom.seed]).toEqual([1080, 1350, 0.9, 99]);
    expect(custom.characterPool).toBe("ABCDEF");
  });

  it("rejects a characterPool with fewer than 2 distinct glyphs", () => {
    expect(specimenOptionsSchema.safeParse({ font: "x.woff2", characterPool: "AAAA" }).success).toBe(
      false,
    );
  });

  it("needs only a font, with defaults filled in", () => {
    const o = specimenOptionsSchema.parse({ font: "fonts/X.woff2" });
    expect(o.weight).toBe(820);
    expect(o.colors.background).toBe("#eceef1");
    expect(o.colors.foreground).toBe("#16181d");
    expect(o.colors.accent).toBeUndefined(); // defaults to background at render
    expect(o.colors.label).toBeUndefined(); // defaults to foreground at render
    expect(o.pulses.length).toBeGreaterThan(0);
    expect(o.mirror).toBe(true); // seamless loop by default
    expect(o.characters).toBe(23);
    expect(o.blacklist).toBe("");
    expect(o.fontSize).toBeUndefined(); // auto-fit by default
    expect(o.characterIntensity).toBe(1);
    expect(o.colorIntensity).toBe(1);
    expect(o.demo).toBe(false);
    expect(o.durationSeconds).toBeUndefined(); // defaults to (mirrored) sum of pulse durations
  });

  it("loads a template's options", () => {
    const o = specimenOptionsSchema.parse({ font: "x.woff2", template: "demo" });
    expect(o.demo).toBe(true); // the demo template turns on demo mode
    expect(o.mirror).toBe(false); // a focused one-way walkthrough
    expect(o.characters).toBe(27); // a fuller specimen than the bare 23 default
    expect(o.pulses.some((p) => p.name === "ease-in")).toBe(true); // and loads the showcase pulses
    // Its even sweeps cover every glyph: colors count tracks the demo's character count.
    expect(o.pulses.find((p) => p.color === "muted")?.colors).toBe(o.characters);
  });

  it("loads the sweep template: a mirrored loop of even, targeted color sweeps", () => {
    const o = specimenOptionsSchema.parse({ font: "x.woff2", template: "sweep" });
    expect(o.mirror).toBe(true); // seamless loop
    expect(o.demo).toBe(false); // a clean showcase, not a labeled walkthrough
    expect(o.colors.accent).toBe("#7c9cff"); // its palette makes the accent sweep visible
    // Every glyph is washed to one token per beat: a sweep covers all `characters` evenly.
    const muted = o.pulses.find((p) => p.color === "muted");
    expect(muted?.colors).toBe(o.characters);
    expect(o.pulses.map((p) => p.color).filter(Boolean)).toEqual(["muted", "accent", "foreground"]);
  });

  it("explicit options override the template", () => {
    const o = specimenOptionsSchema.parse({
      font: "x.woff2",
      template: "demo",
      demo: false,
      characters: 30,
    });
    expect(o.demo).toBe(false); // override wins over the template's demo: true
    expect(o.characters).toBe(30);
  });

  it("fills missing color tokens when only some are overridden", () => {
    const o = specimenOptionsSchema.parse({ font: "x.woff2", colors: { accent: "#ff6600" } });
    expect(o.colors.accent).toBe("#ff6600");
    expect(o.colors.foreground).toBe("#16181d");
    expect(o.colors.background).toBe("#eceef1");
    expect(o.colors.label).toBeUndefined(); // defaults to foreground at render
  });

  it("a pulse defaults to an empty hold (no char/color changes)", () => {
    const o = specimenOptionsSchema.parse({ font: "x.woff2", pulses: [{ duration: 2 }] });
    expect(o.pulses[0]).toMatchObject({ duration: 2, chars: 0, colors: 0, pacing: "even" });
    expect(o.pulses[0]?.color).toBeUndefined(); // no target color → weighted-random recoloring
  });

  it("defaults color weights to 2/2/1 (foreground/muted/accent) and lets them be overridden", () => {
    const o = specimenOptionsSchema.parse({ font: "x.woff2" });
    expect(o.colorWeights).toEqual({ foreground: 2, muted: 2, accent: 1 });

    const o2 = specimenOptionsSchema.parse({ font: "x.woff2", colorWeights: { accent: 0 } });
    expect(o2.colorWeights).toEqual({ foreground: 2, muted: 2, accent: 0 }); // partial override fills rest
  });

  it("accepts a per-pulse target color for an even sweep, and rejects an unknown token", () => {
    const o = specimenOptionsSchema.parse({
      font: "x.woff2",
      pulses: [{ duration: 4, colors: 23, color: "accent", pacing: "even" }],
    });
    expect(o.pulses[0]?.color).toBe("accent");
    expect(
      specimenOptionsSchema.safeParse({
        font: "x.woff2",
        pulses: [{ duration: 4, colors: 1, color: "teal" }],
      }).success,
    ).toBe(false);
  });

  it("requires a font", () => {
    expect(specimenOptionsSchema.safeParse({ name: "ABC Oracle" }).success).toBe(false);
  });

  it("rejects unknown option keys (typo guard)", () => {
    expect(specimenOptionsSchema.safeParse({ font: "x.woff2", fnt: 1 }).success).toBe(false);
  });
});
