import type { ZodIssue } from "zod";

import { RENAMED_EASINGS } from "@/generators/easing";

/**
 * Pre-1.0 option moves/renames/removals, per generator: old key → guidance. Used to turn a
 * strict-schema "Unrecognized key" or enum failure into a pointed migration message instead of a
 * bare rejection. Prune entries a release or two after the change ships.
 */
const MOVED_TO_CAPTURE =
  "moved to settings.capture.cleanup (applied to every URL capture — scroll-reel, screenshots, interaction)";
const MOVED_TO_INTERACTION = 'moved to the "interaction" generator';

const RENAMED_KEYS: Record<string, Record<string, string>> = {
  "scroll-reel": {
    // moved: scripted tours are their own generator now
    actions: MOVED_TO_INTERACTION,
    cursor: MOVED_TO_INTERACTION,
    focus: MOVED_TO_INTERACTION,
    // moved: clean-capture is a settings.capture concern
    hideSelectors: MOVED_TO_CAPTURE,
    injectCss: MOVED_TO_CAPTURE,
    clickSelectors: MOVED_TO_CAPTURE,
    hideScrollbars: MOVED_TO_CAPTURE,
    pauseAnimations: MOVED_TO_CAPTURE,
    freezeClock: MOVED_TO_CAPTURE,
    blockTrackers: MOVED_TO_CAPTURE,
    blockHosts: MOVED_TO_CAPTURE,
    blockResourceTypes: MOVED_TO_CAPTURE,
    // removed outright
    kenBurns: "removed — style the clip in your editor of choice",
    annotations: "removed — annotate in your editor of choice",
    intro: "removed — title cards belong in your editor of choice",
    outro: "removed — title cards belong in your editor of choice",
    capture:
      'removed — scroll-reel is always frame-stepped; for a realtime recording of the live page use the "interaction" generator (a scrollTo action reproduces a realtime scroll)',
    routes:
      "removed — multi-page tours were dropped; capture each route as its own scroll-reel asset and concatenate in your editor of choice",
  },
  wall: {
    size: 'faux-tile "size" was renamed to "caption" (same string)',
  },
};

/**
 * A migration hint for a single option-validation issue, or undefined when the failure isn't a
 * known move/rename: strict-schema unrecognized keys that match a moved/renamed option, and enum
 * failures where the received value is a pre-unification easing name.
 */
export function legacyOptionHint(generatorId: string, issue: ZodIssue): string | undefined {
  if (issue.code === "unrecognized_keys") {
    const renames = RENAMED_KEYS[generatorId];
    if (!renames) return undefined;
    const hints = issue.keys.filter((key) => renames[key]).map((key) => `"${key}" ${renames[key]}`);
    return hints.length ? hints.join("; ") : undefined;
  }
  if (issue.code === "invalid_enum_value" && typeof issue.received === "string") {
    const renamed = RENAMED_EASINGS[issue.received];
    if (renamed && issue.options.includes(renamed)) return `easing names were unified — use "${renamed}"`;
  }
  return undefined;
}

/** A pointed hint for a config that names a generator that no longer exists. */
export function legacyGeneratorHint(generatorId: string): string | undefined {
  if (generatorId === "image") {
    return 'the "image" generator was removed — walls take file paths directly in tiles: { src: "path/to/img.jpg" }';
  }
  return undefined;
}
