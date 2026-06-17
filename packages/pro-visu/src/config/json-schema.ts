import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";
import { settingsSchema } from "@/config/schema";
import { listGenerators } from "@/generators/registry";

type JsonObject = Record<string, unknown>;

/** Convert a zod schema to an inlined (no $ref) JSON Schema fragment, without its own $schema tag. */
function toJson(schema: ZodTypeAny): JsonObject {
  const out = zodToJsonSchema(schema, { $refStrategy: "none" }) as JsonObject;
  // Strip the per-fragment $schema tag — we only want one at the document root.
  delete out.$schema;
  return out;
}

/**
 * Build a draft-07 JSON Schema for a `pro-visu.config.json`, assembled from the live, registered
 * schemas. A JSON config that references it via `$schema` then gets the same editor autocomplete +
 * validation as the typed `defineConfig` path — with no project dependency on this package.
 *
 * Per-generator `options` autocomplete comes from a discriminated union: once `generator` is set,
 * the matching `allOf` branch refines `options` to that generator's own schema. Because it's built
 * from the registry at runtime, `pro-visu init --json` / `pro-visu schema` materialize a schema that
 * always matches the installed tool version (works offline and in any install mode).
 */
export function generateConfigJsonSchema(): JsonObject {
  const generators = listGenerators();

  const optionBranches = generators.map((gen) => ({
    if: { properties: { generator: { const: gen.id } } },
    then: { properties: { options: toJson(gen.optionsSchema) } },
  }));

  const assetItem: JsonObject = {
    type: "object",
    required: ["name", "generator"],
    additionalProperties: false,
    properties: {
      name: {
        type: "string",
        minLength: 1,
        description: "Unique id — also the output filename and manifest key.",
      },
      url: {
        type: "string",
        description:
          "Absolute http(s) URL, or a /path resolved against the managed server. Omit for local generators (wall, specimen, palette, image).",
      },
      generator: {
        description: "Which generator produces this asset.",
        enum: generators.map((g) => g.id),
      },
      options: {
        type: "object",
        description: "Generator-specific options — autocompletes once `generator` is set.",
      },
      inputs: {
        type: "object",
        additionalProperties: { type: "string" },
        description: "Other assets this one consumes, as { slotName: assetName }. Producers run first.",
      },
    },
    allOf: optionBranches,
  };

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "pro-visu config",
    description: "Configuration for the pro-visu CLI (pro-visu.config.json).",
    type: "object",
    required: ["assets"],
    additionalProperties: false,
    properties: {
      // The config file itself may carry a $schema pointer; the runtime validator ignores it.
      $schema: { type: "string" },
      settings: toJson(settingsSchema),
      assets: {
        type: "array",
        minItems: 1,
        description: "What to generate (at least one).",
        items: assetItem,
      },
    },
  };
}

/** Serialize the JSON Schema document for writing to disk. */
export function serializeConfigJsonSchema(): string {
  return `${JSON.stringify(generateConfigJsonSchema(), null, 2)}\n`;
}
