import { describe, expect, it } from "vitest";
import { generatorIds, getGenerator, listGenerators } from "@/generators/registry";
import { SCROLL_REEL_ID } from "@/generators/scroll-reel";
import { SCREENSHOTS_ID } from "@/generators/screenshots";
import { WALL_ID } from "@/generators/wall";
import { SPECIMEN_ID } from "@/generators/specimen";
import { PALETTE_ID } from "@/generators/palette";
import { PALETTE_REEL_ID } from "@/generators/palette-reel";
import { IMAGE_ID } from "@/generators/image";

// The registry is the public catalog of asset types — every built-in must be wired in. Listed
// via each generator's own exported id, so a renamed or dropped id is caught here.
const BUILT_INS = [
  SCROLL_REEL_ID,
  SCREENSHOTS_ID,
  WALL_ID,
  SPECIMEN_ID,
  PALETTE_ID,
  PALETTE_REEL_ID,
  IMAGE_ID,
];

describe("generator registry", () => {
  it("registers exactly the built-in generators (nothing missing or extra)", () => {
    expect([...generatorIds()].sort()).toEqual([...BUILT_INS].sort());
    expect(listGenerators()).toHaveLength(BUILT_INS.length);
  });

  it("keys each generator by its own id and gives it an options schema + run()", () => {
    for (const id of BUILT_INS) {
      const gen = getGenerator(id);
      expect(gen).toBeDefined();
      expect(gen?.id).toBe(id); // registry key matches the generator's own id (no mis-keying)
      expect(gen?.optionsSchema).toBeDefined();
      expect(typeof gen?.run).toBe("function");
    }
  });

  it("has no duplicate ids", () => {
    const ids = generatorIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns undefined for unknown generators", () => {
    expect(getGenerator("does-not-exist")).toBeUndefined();
  });
});
