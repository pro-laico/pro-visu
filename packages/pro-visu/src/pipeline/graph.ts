import type { ResolvedAssetSpec } from "@/config/schema";

/** Unique dependency asset-names for a spec (the values of its `inputs` map). */
export function dependenciesOf(spec: ResolvedAssetSpec): string[] {
  return [...new Set(Object.values(spec.inputs))];
}

/**
 * Validate the asset dependency graph: every `inputs` reference must name a real asset, and
 * there must be no cycles. Throws a descriptive error otherwise. Returns the spec list by name.
 */
export function buildGraph(specs: ResolvedAssetSpec[]): Map<string, ResolvedAssetSpec> {
  const byName = new Map(specs.map((s) => [s.name, s]));

  for (const spec of specs) {
    for (const [slot, dep] of Object.entries(spec.inputs)) {
      if (!byName.has(dep)) {
        throw new Error(
          `Asset "${spec.name}" input "${slot}" references unknown asset "${dep}".`,
        );
      }
      if (dep === spec.name) {
        throw new Error(`Asset "${spec.name}" cannot depend on itself.`);
      }
    }
  }

  assertAcyclic(specs);
  return byName;
}

/** DFS cycle check; throws with the offending cycle path. */
function assertAcyclic(specs: ResolvedAssetSpec[]): void {
  const byName = new Map(specs.map((s) => [s.name, s]));
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const visit = (name: string): void => {
    const s = state.get(name);
    if (s === "done") return;
    if (s === "visiting") {
      const from = stack.indexOf(name);
      const cycle = [...stack.slice(from), name].join(" → ");
      throw new Error(`Cyclic asset dependency: ${cycle}.`);
    }
    state.set(name, "visiting");
    stack.push(name);
    const spec = byName.get(name);
    if (spec) for (const dep of dependenciesOf(spec)) visit(dep);
    stack.pop();
    state.set(name, "done");
  };

  for (const spec of specs) visit(spec.name);
}

/**
 * Given a user selection of asset names, expand it to include every transitive dependency
 * (you can't build an asset without its inputs). Preserves config order. Unknown selected
 * names are ignored here (the caller warns); unknown *dependencies* are caught by buildGraph.
 */
export function expandSelection(
  specs: ResolvedAssetSpec[],
  names: string[] | undefined,
): ResolvedAssetSpec[] {
  if (!names || names.length === 0) return specs;
  const byName = new Map(specs.map((s) => [s.name, s]));
  const wanted = new Set<string>();

  const add = (name: string): void => {
    if (wanted.has(name)) return;
    const spec = byName.get(name);
    if (!spec) return;
    wanted.add(name);
    for (const dep of dependenciesOf(spec)) add(dep);
  };
  for (const name of names) add(name);

  return specs.filter((s) => wanted.has(s.name));
}
