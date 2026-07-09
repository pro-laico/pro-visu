import { describe, expect, it } from "vitest";
import {
  buildGraph,
  dependenciesOf,
  enabledAssetNames,
  expandSelection,
  resolveSelection,
} from "@/pipeline/graph";
import type { EnabledFlag, ResolvedAssetSpec } from "@/config/schema";

function spec(
  name: string,
  inputs: Record<string, string> = {},
  generator = "scene",
  enabled: EnabledFlag = true,
): ResolvedAssetSpec {
  return { name, url: "https://example.com", generator, options: {}, inputs, enabled };
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

  it("returns nothing for an empty selection (vs undefined = all)", () => {
    expect(expandSelection(specs, [])).toEqual([]);
  });
});

describe("enabledAssetNames", () => {
  const specs = [
    spec("a", {}, "scene", true),
    spec("b", {}, "scene", false),
    spec("quick", {}, "scene", "quick-test"),
    spec("full", {}, "scene", "full-test"),
  ];

  it("runs every non-false asset when settings.enabled is true", () => {
    expect(enabledAssetNames(specs, true)).toEqual(["a", "quick", "full"]);
  });

  it("runs nothing when settings.enabled is false", () => {
    expect(enabledAssetNames(specs, false)).toEqual([]);
  });

  it("runs only the matching group when settings.enabled is a string", () => {
    expect(enabledAssetNames(specs, "quick-test")).toEqual(["quick"]);
  });

  it("never runs an individually disabled asset, even under a matching group", () => {
    const withDisabledGroup = [...specs, spec("off", {}, "scene", false)];
    expect(enabledAssetNames(withDisabledGroup, "full-test")).toEqual(["full"]);
  });
});

describe("resolveSelection", () => {
  const specs = [
    spec("base", {}, "scene", "quick-test"),
    spec("mid", { in: "base" }, "scene", true), // dep of leaf, but not in the group
    spec("leaf", { in: "mid" }, "scene", "quick-test"),
    spec("other", {}, "scene", "full-test"),
  ];

  it("explicit requested names override the group toggle (even a disabled one)", () => {
    const disabled = [spec("x", {}, "scene", false), spec("y", {}, "scene", true)];
    expect(resolveSelection(disabled, ["x"], "some-group").map((s) => s.name)).toEqual(["x"]);
  });

  it("pulls transitive deps of group-selected assets regardless of their own enabled", () => {
    // leaf is in "quick-test"; its deps mid + base come along even though mid is ungrouped.
    expect(resolveSelection(specs, undefined, "quick-test").map((s) => s.name)).toEqual([
      "base",
      "mid",
      "leaf",
    ]);
  });

  it("returns nothing when the group matches no assets", () => {
    expect(resolveSelection(specs, undefined, "nope")).toEqual([]);
  });
});
