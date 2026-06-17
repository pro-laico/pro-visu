import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateConfigJsonSchema } from "@/config/json-schema";
import { generatorIds } from "@/generators/registry";
import { runSchema } from "@/cli/commands/schema";

type JsonObject = Record<string, unknown>;

describe("generateConfigJsonSchema", () => {
  const schema = generateConfigJsonSchema() as JsonObject;
  const props = schema.properties as JsonObject;

  it("is a draft-07 document requiring `assets`", () => {
    expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(schema.required).toContain("assets");
  });

  it("exposes the settings shape (e.g. outDir)", () => {
    const settings = props.settings as JsonObject;
    expect((settings.properties as JsonObject).outDir).toBeDefined();
  });

  it("lists every registered generator in the asset `generator` enum", () => {
    const assets = props.assets as JsonObject;
    const item = assets.items as JsonObject;
    const generator = (item.properties as JsonObject).generator as JsonObject;
    expect(new Set(generator.enum as string[])).toEqual(new Set(generatorIds()));
  });

  it("adds a per-generator options branch with that generator's own schema", () => {
    const item = ((props.assets as JsonObject).items as JsonObject);
    const branches = item.allOf as Array<JsonObject>;
    expect(branches).toHaveLength(generatorIds().length);

    // The screenshots branch should refine `options` to the screenshots schema (e.g. `breakpoints`).
    const shots = branches.find(
      (b) => (((b.if as JsonObject).properties as JsonObject).generator as JsonObject).const === "screenshots",
    );
    const optionProps = ((((shots!.then as JsonObject).properties as JsonObject).options as JsonObject)
      .properties as JsonObject);
    expect(optionProps.breakpoints).toBeDefined();
    expect(optionProps.fullPage).toBeDefined();
  });
});

describe("runSchema", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "showcase-schema-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes a valid pro-visu.schema.json to the cwd", async () => {
    await runSchema({ cwd: dir });
    const written = JSON.parse(readFileSync(path.join(dir, "pro-visu.schema.json"), "utf8"));
    expect(written.title).toBe("pro-visu config");
    expect(written.required).toContain("assets");
  });

  it("honors a custom --out path", async () => {
    await runSchema({ cwd: dir, out: "config/pro-visu.schema.json" });
    const written = JSON.parse(
      readFileSync(path.join(dir, "config", "pro-visu.schema.json"), "utf8"),
    );
    expect(written.$schema).toBe("http://json-schema.org/draft-07/schema#");
  });
});
