import type { ScrollReelOptions } from "@/generators/scroll-reel/options";

/**
 * Author-facing config types. These power editor autocomplete in `showcase.config.ts`.
 * The runtime validator lives in `schema.ts`; each generator validates its own options.
 * When a new generator is added, extend `AssetSpecInput` and `defaults` here.
 */

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

export interface BrowserSettingsInput {
  headless?: boolean;
  channel?: string;
  executablePath?: string;
  args?: string[];
  timeout?: number;
}

export interface ShowcaseSettingsInput {
  outDir?: string;
  concurrency?: number;
  logLevel?: LogLevel;
  browser?: BrowserSettingsInput;
  /** Per-generator option defaults, keyed by generator id, merged under each asset. */
  defaults?: {
    "scroll-reel"?: ScrollReelOptions;
  };
}

/** Discriminated by `generator` so each asset gets the right `options` autocomplete. */
export type AssetSpecInput = {
  name: string;
  url: string;
  generator: "scroll-reel";
  options?: ScrollReelOptions;
};

export interface ShowcaseUserConfig {
  settings?: ShowcaseSettingsInput;
  assets: AssetSpecInput[];
}

/** Identity helper that gives `showcase.config.ts` full type-checking + autocomplete. */
export function defineConfig(config: ShowcaseUserConfig): ShowcaseUserConfig {
  return config;
}
