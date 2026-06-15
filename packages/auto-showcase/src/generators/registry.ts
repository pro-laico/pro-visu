import type { Generator } from "@/generators/types";
import { scrollReelGenerator } from "@/generators/scroll-reel";
import { screenshotsGenerator } from "@/generators/screenshots";
import { sceneGenerator } from "@/generators/scene";
import { specimenGenerator } from "@/generators/specimen";
import { paletteGenerator } from "@/generators/palette";
import { paletteReelGenerator } from "@/generators/palette-reel";

const registry = new Map<string, Generator<unknown>>();

export function register<T>(gen: Generator<T>): void {
  registry.set(gen.id, gen as Generator<unknown>);
}

export function getGenerator(id: string): Generator<unknown> | undefined {
  return registry.get(id);
}

export function listGenerators(): Generator<unknown>[] {
  return [...registry.values()];
}

export function generatorIds(): string[] {
  return [...registry.keys()];
}

// Register built-in generators. New asset types add a line here.
register(scrollReelGenerator);
register(screenshotsGenerator);
register(sceneGenerator);
register(specimenGenerator);
register(paletteGenerator);
register(paletteReelGenerator);
