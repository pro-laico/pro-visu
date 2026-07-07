import { describe, expect, it } from "vitest";
import { SCENE_OPTION_SCHEMAS, wallSceneOptionsSchema } from "@/scene-engine/scene-options";
import { wallOptionsSchema } from "@/generators/wall/options";
import { generatorIds, getGenerator } from "@/generators/registry";
import { WALL_ID } from "@/generators/wall";
import { assetSpecSchema } from "@/config/schema";

describe("wall generator", () => {
  it("is registered; the generic 'scene' generator is gone", () => {
    expect(generatorIds()).toContain(WALL_ID);
    expect(getGenerator(WALL_ID)?.id).toBe(WALL_ID);
    expect(generatorIds()).not.toContain("scene");
  });

  const threeColumns = [{ tiles: ["a"] }, { tiles: ["b"] }, { tiles: ["c"] }];

  it("applies friendly wall defaults", () => {
    const o = wallOptionsSchema.parse({ columns: threeColumns });
    expect(o.output.width).toBe(1920);
    expect(o.output.height).toBe(1080);
    expect(o.columns).toHaveLength(3); // count = array length
    expect(o.layout.gap).toBe(8);
    expect(o.motion.loops).toBe(0); // static by default — a pulse (or explicit loops) makes a column move
    expect(o.motion.pulses).toEqual([]); // no wall-level default pulses
    expect(o.motion.pan.loops).toBe(0); // System 1: no pan unless configured
    expect(o.layout.tileAspect).toBeCloseTo(0.75);
    expect(o.render.capture).toBe("frames");
    expect(o.motion.durationMs).toBe(16_000);
    expect(o.preview.enabled).toBe(false); // preview mode off by default
    expect(o.preview.tiles).toEqual({});
  });

  it("in test mode derives no inputs (faux tiles → no producers run)", () => {
    const o = wallOptionsSchema.parse({
      preview: { enabled: true },
      columns: [{ tiles: ["a", "b"] }, { tiles: ["c"] }, { tiles: ["d"] }],
    });
    expect(getGenerator(WALL_ID)?.deriveInputs?.(o)).toEqual({});
  });

  it("defaults a pulse's easing and requires at/span/distance", () => {
    const o = wallOptionsSchema.parse({
      columns: [{ tiles: ["a"], pulses: [{ at: 0.2, span: 0.2, distance: 0.5 }] }, { tiles: ["b"] }, { tiles: ["c"] }],
    });
    expect(o.columns[0]?.pulses?.[0]?.easing).toBe("ease-in-out");
    expect(wallOptionsSchema.safeParse({ columns: [{ tiles: ["a"], pulses: [{ at: 0.2 }] }, { tiles: ["b"] }, { tiles: ["c"] }] }).success).toBe(false);
  });

  it("treats pulse `span` as a 0..1 clip fraction (a late pulse auto-shifts; >1 is rejected)", () => {
    // at 0.9 + span 0.2 overruns the clip — but it's accepted and the start auto-shifts (no error).
    expect(
      wallOptionsSchema.safeParse({
        columns: [{ tiles: ["a"], pulses: [{ at: 0.9, span: 0.2, distance: 0.5 }] }, { tiles: ["b"] }, { tiles: ["c"] }],
      }).success,
    ).toBe(true);
    // a span longer than the whole clip is meaningless → rejected by the schema (max 1).
    expect(
      wallOptionsSchema.safeParse({
        columns: [{ tiles: ["a"], pulses: [{ at: 0.1, span: 1.5, distance: 0.5 }] }, { tiles: ["b"] }, { tiles: ["c"] }],
      }).success,
    ).toBe(false);
  });

  it("requires at least 3 columns, each with at least one tile", () => {
    expect(wallOptionsSchema.safeParse({ columns: [{ tiles: ["a"] }, { tiles: ["b"] }] }).success).toBe(false);
    expect(wallOptionsSchema.safeParse({ columns: [...threeColumns, { tiles: [] }] }).success).toBe(false);
  });

  it("rejects unknown option keys (typo guard)", () => {
    expect(wallOptionsSchema.safeParse({ columns: threeColumns, colums: 6 }).success).toBe(false);
  });

  it("derives inputs (slot=assetName) from every column tile", () => {
    const o = wallOptionsSchema.parse({
      columns: [{ tiles: ["img-a", "clip-b"] }, { tiles: ["img-a", "ui-c"] }, { tiles: ["ui-d"] }],
    });
    expect(getGenerator(WALL_ID)?.deriveInputs?.(o)).toEqual({
      "img-a": "img-a",
      "clip-b": "clip-b",
      "ui-c": "ui-c",
      "ui-d": "ui-d",
    });
  });

  it("a wall asset is valid without a url (local generator; resolves inputs)", () => {
    expect(assetSpecSchema.safeParse({ name: "w", generator: "wall" }).success).toBe(true);
  });
});

describe("scene option schemas (the shared engine)", () => {
  it("exposes a schema per remaining built-in scene", () => {
    expect(Object.keys(SCENE_OPTION_SCHEMAS).sort()).toEqual(["palette-reel", "specimen", "wall"]);
  });

  it("fills wall scene defaults (uniform pulse model) and rejects a typo", () => {
    const o = wallSceneOptionsSchema.parse({ columns: [{ tiles: ["a"] }, { tiles: ["b"] }, { tiles: ["c"] }] });
    expect(o.columns).toHaveLength(3); // System 2: each column is its own unit (tiles + motion)
    expect(o.gap).toBe(16);
    expect(o.background).toBeUndefined(); // inherits the scene background unless set
    expect(o.pan.loops).toBe(0); // System 1: no pan unless configured
    expect(o.pan.direction).toBe("left");
    expect(o.loops).toBe(0); // static by default — a pulse (or explicit loops) makes a column move
    expect(o.pulses).toEqual([]); // no wall-level default pulses
    expect(wallSceneOptionsSchema.safeParse({ colums: 6 }).success).toBe(false);
  });
});
