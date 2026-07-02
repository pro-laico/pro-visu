import type { ZodIssue } from "zod";

/**
 * Pre-1.0 option renames, per generator: old key → guidance. Used to turn a strict-schema
 * "Unrecognized key" or enum failure into a pointed migration message instead of a bare rejection.
 * Prune entries a release or two after the rename ships.
 */
const RENAMED_KEYS: Record<string, Record<string, string>> = {
  "scroll-reel": {
    duration: 'renamed to "durationMs" (same unit — milliseconds)',
  },
  screenshots: {
    breakpoints: 'renamed to "viewports" (same shape)',
  },
  wall: {
    durationSeconds: 'renamed to "durationMs" and now in milliseconds (16 → 16000)',
    duration: 'pulse "duration" was renamed to "span" (same 0..1 clip fraction)',
  },
  specimen: {
    durationSeconds: 'renamed to "durationMs" and now in milliseconds (10 → 10000)',
    duration: 'pulse "duration" was renamed to "durationMs" and is now in milliseconds (0.8 → 800)',
  },
  "palette-reel": {
    holdSeconds: 'renamed to "holdMs" and now in milliseconds (2 → 2000)',
    transitionSeconds: 'renamed to "transitionMs" and now in milliseconds (0.7 → 700)',
    durationSeconds: 'renamed to "durationMs" and now in milliseconds (10 → 10000)',
  },
};

/** camelCase → kebab-case ("easeInOutCubic" → "ease-in-out-cubic"). */
function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * A migration hint for a single option-validation issue, or undefined when the failure isn't a
 * known rename: strict-schema unrecognized keys that match a renamed option, and enum failures
 * where the received value is an old camelCase easing spelling of a now-kebab-case name.
 */
export function legacyOptionHint(generatorId: string, issue: ZodIssue): string | undefined {
  if (issue.code === "unrecognized_keys") {
    const renames = RENAMED_KEYS[generatorId];
    if (!renames) return undefined;
    const hints = issue.keys.filter((key) => renames[key]).map((key) => `"${key}" ${renames[key]}`);
    return hints.length ? hints.join("; ") : undefined;
  }
  if (issue.code === "invalid_enum_value" && typeof issue.received === "string") {
    const kebabbed = kebab(issue.received);
    if (kebabbed !== issue.received && issue.options.includes(kebabbed)) {
      return `easing names are kebab-case now — use "${kebabbed}"`;
    }
  }
  return undefined;
}
