import { describe, expect, it } from "vitest";
import { specimenOptionsSchema } from "@/generators/specimen/options";
import { generatorIds, getGenerator } from "@/generators/registry";
import { SPECIMEN_ID } from "@/generators/specimen";

describe("specimen generator", () => {
  it("is registered", () => {
    expect(generatorIds()).toContain(SPECIMEN_ID);
    expect(getGenerator(SPECIMEN_ID)?.id).toBe(SPECIMEN_ID);
  });

  it("needs only a font, with 16:9 defaults filled in", () => {
    const o = specimenOptionsSchema.parse({ font: "fonts/X.woff2" });
    expect(o.width).toBe(1920);
    expect(o.height).toBe(1080);
    expect(o.durationSeconds).toBe(60);
    expect(o.columns).toBe(9);
    expect(o.rows).toBe(3);
    expect(o.weight).toBe(820);
    expect(o.background).toBe("#eceef1");
  });

  it("requires a font", () => {
    expect(specimenOptionsSchema.safeParse({ name: "ABC Oracle" }).success).toBe(false);
  });

  it("rejects unknown option keys (typo guard)", () => {
    expect(specimenOptionsSchema.safeParse({ font: "x.woff2", fnt: 1 }).success).toBe(false);
  });
});
