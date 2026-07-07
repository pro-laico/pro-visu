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
    expect(o.output.width).toBe(1920);
    expect(o.output.height).toBe(1080);
    expect(o.type.leading).toBe(0.78);
    expect(o.animation.seed).toBe(1);
    expect(o.type.characterPool).toBeUndefined(); // falls back to the master pool at render

    const custom = specimenOptionsSchema.parse({
      font: "x.woff2",
      output: { width: 1080, height: 1350 },
      type: { leading: 0.9, characterPool: "ABCDEF" },
      animation: { seed: 99 },
    });
    expect([custom.output.width, custom.output.height, custom.type.leading, custom.animation.seed]).toEqual([
      1080, 1350, 0.9, 99,
    ]);
    expect(custom.type.characterPool).toBe("ABCDEF");
  });

  it("rejects a characterPool with fewer than 2 distinct glyphs", () => {
    expect(
      specimenOptionsSchema.safeParse({ font: "x.woff2", type: { characterPool: "AAAA" } }).success,
    ).toBe(false);
  });

  it("needs only a font, with defaults filled in", () => {
    const o = specimenOptionsSchema.parse({ font: "fonts/X.woff2" });
    expect(o.type.weight).toBe(400);
    expect(o.type.fill).toBe(0.8);
    expect(o.colors.background).toBe("#eceef1");
    expect(o.colors.foreground).toBe("#16181d");
    expect(o.colors.accent).toBeUndefined(); // defaults to background at render
    expect(o.label.anchor).toBe("bottom-left"); // label sits bottom-left of the gap by default
    expect(o.label.padding).toBe(32);
    expect(o.label.size).toBe(0.22);
    expect(o.label.weight).toBe(500);
    expect(o.label.color).toBeUndefined(); // defaults to foreground at render
    expect(o.pulses.length).toBeGreaterThan(0);
    expect(o.animation.mirror).toBe(true); // seamless loop by default
    expect(o.type.lines).toBe(3);
    expect(o.animation.maxLineDrift).toBe(0.05);
    expect(o.type.blacklist).toBe("");
    expect(o.animation.characterIntensity).toBe(1);
    expect(o.animation.colorIntensity).toBe(1);
    expect(o.animation.demo).toBe(false);
    expect(o.animation.durationMs).toBeUndefined(); // defaults to (mirrored) sum of pulse durations
  });

  it("loads a template's options", () => {
    const o = specimenOptionsSchema.parse({ font: "x.woff2", template: "demo" });
    expect(o.animation.demo).toBe(true); // the demo template turns on demo mode
    expect(o.animation.mirror).toBe(false); // a focused one-way walkthrough
    expect(o.type.lines).toBe(4); // the template sets a fuller wall
    expect(o.pulses.some((p) => p.name === "ease-in")).toBe(true); // and loads the showcase pulses
    // Its even sweeps cover every glyph once: colors is the fraction 1.
    expect(o.pulses.find((p) => p.color === "muted")?.colors).toBe(1);
  });

  it("loads the sweep template: a mirrored loop of even, targeted color sweeps", () => {
    const o = specimenOptionsSchema.parse({ font: "x.woff2", template: "sweep" });
    expect(o.animation.mirror).toBe(true); // seamless loop
    expect(o.animation.demo).toBe(false); // a clean showcase, not a labeled walkthrough
    expect(o.colors.accent).toBe("#7c9cff"); // its palette makes the accent sweep visible
    // Every glyph is washed to one token per beat: a full sweep is the fraction 1.
    const muted = o.pulses.find((p) => p.color === "muted");
    expect(muted?.colors).toBe(1);
    expect(o.pulses.map((p) => p.color).filter(Boolean)).toEqual(["muted", "accent", "foreground"]);
  });

  it("explicit options override the template (deep, per-field)", () => {
    const o = specimenOptionsSchema.parse({
      font: "x.woff2",
      template: "demo",
      animation: { demo: false },
      type: { lines: 6 },
    });
    expect(o.animation.demo).toBe(false); // override wins over the template's demo: true
    expect(o.animation.mirror).toBe(false); // sibling preset field survives the deep merge
    expect(o.type.lines).toBe(6);
  });

  it("fills missing color tokens when only some are overridden", () => {
    const o = specimenOptionsSchema.parse({ font: "x.woff2", colors: { accent: "#ff6600" } });
    expect(o.colors.accent).toBe("#ff6600");
    expect(o.colors.foreground).toBe("#16181d");
    expect(o.colors.background).toBe("#eceef1");
  });

  it("accepts a label block and fills its defaults", () => {
    const o = specimenOptionsSchema.parse({
      font: "x.woff2",
      name: "ABC Oracle",
      label: { anchor: "top-right", padding: 0, color: "#ff0000" },
    });
    expect(o.label.anchor).toBe("top-right");
    expect(o.label.padding).toBe(0);
    expect(o.label.size).toBe(0.22); // unset → default
    expect(o.label.weight).toBe(500); // unset → default
    expect(o.label.color).toBe("#ff0000");
  });

  it("a pulse defaults to an empty hold (no char/color changes)", () => {
    const o = specimenOptionsSchema.parse({ font: "x.woff2", pulses: [{ durationMs: 2000 }] });
    expect(o.pulses[0]).toMatchObject({ durationMs: 2000, chars: 0, colors: 0, pacing: "even" });
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
      pulses: [{ durationMs: 4000, colors: 1, color: "accent", pacing: "even" }],
    });
    expect(o.pulses[0]?.color).toBe("accent");
    expect(
      specimenOptionsSchema.safeParse({
        font: "x.woff2",
        pulses: [{ durationMs: 4000, colors: 1, color: "teal" }],
      }).success,
    ).toBe(false);
  });

  it("requires a font", () => {
    expect(specimenOptionsSchema.safeParse({ name: "ABC Oracle" }).success).toBe(false);
  });

  it("rejects unknown option keys (typo guard)", () => {
    expect(specimenOptionsSchema.safeParse({ font: "x.woff2", fnt: 1 }).success).toBe(false);
  });

  it("derives glyph size from `lines` only — rejects fontSize / characters", () => {
    expect(specimenOptionsSchema.parse({ font: "x.woff2" }).type.lines).toBe(3);
    expect(specimenOptionsSchema.parse({ font: "x.woff2", type: { lines: 8 } }).type.lines).toBe(8);
    expect(specimenOptionsSchema.safeParse({ font: "x.woff2", type: { lines: 0 } }).success).toBe(false);
    expect(specimenOptionsSchema.safeParse({ font: "x.woff2", type: { fontSize: 80 } }).success).toBe(false);
    expect(specimenOptionsSchema.safeParse({ font: "x.woff2", characters: 20 }).success).toBe(false);
  });

  it("steps glyph weight to multiples of 100 (font-shipped weights only)", () => {
    expect(specimenOptionsSchema.parse({ font: "x.woff2", type: { weight: 700 } }).type.weight).toBe(700);
    expect(specimenOptionsSchema.safeParse({ font: "x.woff2", type: { weight: 820 } }).success).toBe(false);
    expect(specimenOptionsSchema.safeParse({ font: "x.woff2", type: { weight: 480 } }).success).toBe(false);
  });

  it("makes the glyph-wall fill fraction configurable", () => {
    expect(specimenOptionsSchema.parse({ font: "x.woff2", type: { fill: 0.9 } }).type.fill).toBe(0.9);
    expect(specimenOptionsSchema.safeParse({ font: "x.woff2", type: { fill: 1.5 } }).success).toBe(false);
  });

  it("accepts fractional pulse change-counts", () => {
    const o = specimenOptionsSchema.parse({
      font: "x.woff2",
      pulses: [{ durationMs: 2000, chars: 0.5, colors: 0.25 }],
    });
    expect(o.pulses[0]).toMatchObject({ chars: 0.5, colors: 0.25 });
  });
});
