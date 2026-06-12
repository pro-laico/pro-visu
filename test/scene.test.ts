import { describe, expect, it } from "vitest";
import { sceneOptionsSchema } from "@/generators/scene/options";
import { generatorIds, getGenerator } from "@/generators/registry";
import { SCENE_ID } from "@/generators/scene";

describe("scene generator", () => {
  it("is registered", () => {
    expect(generatorIds()).toContain(SCENE_ID);
    expect(getGenerator(SCENE_ID)?.id).toBe(SCENE_ID);
  });

  it("applies sensible defaults", () => {
    const opts = sceneOptionsSchema.parse({});
    expect(opts.scene).toBe("phone");
    expect(opts.width).toBe(1080);
    expect(opts.height).toBe(1080);
    expect(opts.capture).toBe("realtime");
    expect(opts.fps).toBe(30);
    expect(opts.sceneOptions).toEqual({});
  });

  it("rejects unknown option keys (typo guard)", () => {
    expect(sceneOptionsSchema.safeParse({ scenes: "phone" }).success).toBe(false);
  });

  it("keeps a url-free asset valid in config (scene needs no url)", () => {
    // assetSpecSchema allows omitting url; scene resolves inputs instead.
    expect(sceneOptionsSchema.parse({ scene: "phone" }).scene).toBe("phone");
  });
});
