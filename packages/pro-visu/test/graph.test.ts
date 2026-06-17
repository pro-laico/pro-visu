import { describe, expect, it } from "vitest";
import { buildGraph, dependenciesOf, expandSelection } from "@/pipeline/graph";
import type { ResolvedAssetSpec } from "@/config/schema";

function spec(
  name: string,
  inputs: Record<string, string> = {},
  generator = "scene",
): ResolvedAssetSpec {
  return { name, url: "https://example.com", generator, options: {}, inputs };
}

describe("dependenciesOf", () => {
  it("returns unique dependency asset names", () => {
    const s = spec("c", { a: "x", b: "x", d: "y" });
    expect(dependenciesOf(s).sort()).toEqual(["x", "y"]);
  });
});

describe("buildGraph", () => {
  it("accepts a valid DAG", () => {
    const specs = [spec("a"), spec("b", { in: "a" }), spec("c", { in: "b" })];
    expect(() => buildGraph(specs)).not.toThrow();
  });

  it("rejects an unknown input reference", () => {
    const specs = [spec("b", { in: "missing" })];
    expect(() => buildGraph(specs)).toThrow(/unknown asset "missing"/);
  });

  it("rejects self-dependency", () => {
    expect(() => buildGraph([spec("a", { in: "a" })])).toThrow(/cannot depend on itself/);
  });

  it("rejects cycles", () => {
    const specs = [spec("a", { in: "b" }), spec("b", { in: "a" })];
    expect(() => buildGraph(specs)).toThrow(/Cyclic asset dependency/);
  });
});

describe("expandSelection", () => {
  const specs = [
    spec("base"),
    spec("mid", { in: "base" }),
    spec("leaf", { in: "mid" }),
    spec("unrelated"),
  ];

  it("returns everything when no selection is given", () => {
    expect(expandSelection(specs, undefined).map((s) => s.name)).toEqual([
      "base",
      "mid",
      "leaf",
      "unrelated",
    ]);
  });

  it("pulls in transitive dependencies of a selected asset", () => {
    // selecting only "leaf" must also include mid + base, in config order
    expect(expandSelection(specs, ["leaf"]).map((s) => s.name)).toEqual([
      "base",
      "mid",
      "leaf",
    ]);
  });

  it("does not include unrelated assets", () => {
    expect(expandSelection(specs, ["mid"]).map((s) => s.name)).not.toContain("unrelated");
  });
});
