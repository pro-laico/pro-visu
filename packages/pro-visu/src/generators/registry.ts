import { wallGenerator } from "@/generators/wall";
import type { Generator } from "@/generators/types";
import { iconsGenerator } from "@/generators/icons";
import { paletteGenerator } from "@/generators/palette";
import { specimenGenerator } from "@/generators/specimen";
import { scrollReelGenerator } from "@/generators/scroll-reel";
import { interactionGenerator } from "@/generators/interaction";
import { screenshotsGenerator } from "@/generators/screenshots";
import { paletteReelGenerator } from "@/generators/palette-reel";

const registry = new Map<string, Generator<unknown>>();

function register<T>(gen: Generator<T>): void {
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
register(interactionGenerator);
register(screenshotsGenerator);
register(wallGenerator);
register(specimenGenerator);
register(iconsGenerator);
register(paletteGenerator);
register(paletteReelGenerator);
