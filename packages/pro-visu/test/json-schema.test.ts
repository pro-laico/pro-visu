import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateConfigJsonSchema,
  refreshSchemaFile,
  serializeConfigJsonSchema,
  DEFAULT_SCHEMA_FILE,
} from "@/config/json-schema";
import { generatorIds } from "@/generators/registry";
import { TOOL_VERSION } from "@/version";

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
    expect(optionProps.viewports).toBeDefined();
    expect(optionProps.fullPage).toBeDefined();
  });
});

describe("refreshSchemaFile", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "showcase-schema-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("does nothing when no schema file exists", async () => {
    await refreshSchemaFile(dir);
    expect(() => readFileSync(path.join(dir, DEFAULT_SCHEMA_FILE), "utf8")).toThrow();
  });

  it("leaves a current-version schema untouched", async () => {
    const file = path.join(dir, DEFAULT_SCHEMA_FILE);
    writeFileSync(file, serializeConfigJsonSchema(), "utf8");
    const before = readFileSync(file, "utf8");
    await refreshSchemaFile(dir);
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("rewrites a schema stamped by another tool version", async () => {
    const file = path.join(dir, DEFAULT_SCHEMA_FILE);
    const stale = JSON.parse(serializeConfigJsonSchema()) as Record<string, unknown>;
    stale["x-tool-version"] = "0.0.1";
    writeFileSync(file, JSON.stringify(stale), "utf8");
    await refreshSchemaFile(dir);
    const written = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    expect(written["x-tool-version"]).toBe(TOOL_VERSION);
    expect(written.title).toBe("pro-visu config");
  });
});
