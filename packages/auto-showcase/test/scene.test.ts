import { describe, expect, it } from "vitest";
import { sceneOptionsSchema } from "@/generators/scene/options";
import {
  SCENE_OPTION_SCHEMAS,
  browserSceneOptionsSchema,
  phoneSceneOptionsSchema,
  wallSceneOptionsSchema,
} from "@/generators/scene/scene-options";
import { generatorIds, getGenerator } from "@/generators/registry";
import { SCENE_ID } from "@/generators/scene";
import { assetSpecSchema } from "@/config/schema";

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

  it("a scene asset is valid without a url (url-based generators require one; scene resolves inputs)", () => {
    // assetSpecSchema makes url optional precisely so local scenes can omit it; this fails if
    // url ever becomes required.
    expect(assetSpecSchema.safeParse({ name: "hero", generator: "scene" }).success).toBe(true);
    expect(assetSpecSchema.safeParse({ name: "hero", generator: "scene", url: "not-a-url" }).success).toBe(
      false,
    );
  });
});

describe("per-scene option schemas", () => {
  it("exposes a schema per built-in scene", () => {
    expect(Object.keys(SCENE_OPTION_SCHEMAS).sort()).toEqual([
      "browser",
      "laptop",
      "palette-reel",
      "phone",
      "specimen",
      "wall",
    ]);
  });

  it("fills wall defaults (passive pulse motion) and rejects a typo", () => {
    const o = wallSceneOptionsSchema.parse({});
    expect(o.columns).toBe(4);
    expect(o.padding).toBe(16);
    expect(o.background).toBeUndefined(); // inherits the scene background unless set
    expect(o.panLoops).toBe(1);
    expect(o.scrollLoopsMin).toBe(1);
    expect(o.scrollLoopsMax).toBe(2);
    expect(o.pulses).toBe(4);
    expect(o.pulseDuration).toBe(1);
    expect(o.baseDrift).toBeCloseTo(0.08);
    expect(o.pulseVariance).toBeCloseTo(0.6);
    expect(o.alternate).toBe(true);
    expect(wallSceneOptionsSchema.safeParse({ colums: 6 }).success).toBe(false);
  });

  it("fills phone styling defaults to the previous hardcoded values", () => {
    const o = phoneSceneOptionsSchema.parse({});
    expect(o.bezel).toBe("#0a0a0a");
    expect(o.shadow).toBe("0 40px 120px rgba(0,0,0,0.5)");
    expect(o.radiusScale).toBe(1);
    expect(o.screenBackground).toBe("#000");
  });

  it("defaults the browser dots + colors and accepts overrides", () => {
    const o = browserSceneOptionsSchema.parse({});
    expect(o.dots).toBe(true);
    expect(o.dotColors).toEqual(["#ff5f57", "#febc2e", "#28c840"]);
    const custom = browserSceneOptionsSchema.parse({ dots: false, dotColors: ["#111", "#222", "#333"] });
    expect(custom.dots).toBe(false);
    expect(custom.dotColors).toEqual(["#111", "#222", "#333"]);
  });

  it("rejects a typo'd scene option key (the whole point of typed sceneOptions)", () => {
    expect(phoneSceneOptionsSchema.safeParse({ bezl: "#000" }).success).toBe(false);
  });
});
