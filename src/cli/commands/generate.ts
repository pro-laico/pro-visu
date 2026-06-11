import { resolveCwd, resolveOutDir } from "@/utils/paths";
import { createLogger, type Logger } from "@/utils/logger";
import { loadShowcaseConfig } from "@/config/load";
import { ensureChromium } from "@/browser-install/ensure-chromium";
import { runPipeline } from "@/pipeline/runner";
import { TOOL_VERSION } from "@/version";
import { reportConfigError, printSummary } from "@/cli/ui";

export interface GenerateOptions {
  cwd?: string;
  config?: string;
  asset?: string | string[];
  concurrency?: string | number;
  skipBrowser?: boolean;
  verbose?: boolean;
}

export async function runGenerate(options: GenerateOptions = {}): Promise<void> {
  const cwd = resolveCwd(options.cwd);
  const bootstrapLog: Logger = createLogger(options.verbose ? "debug" : "info");

  let loaded;
  try {
    loaded = await loadShowcaseConfig({ cwd, configFile: options.config });
  } catch (err) {
    reportConfigError(bootstrapLog, err);
    process.exitCode = 1;
    return;
  }
  const { config } = loaded;
  const logger = createLogger(options.verbose ? "debug" : config.settings.logLevel);
  const outDir = resolveOutDir(cwd, config.settings.outDir);

  const requested = normalizeAssetNames(options.asset);
  if (requested) {
    const known = new Set(config.assets.map((a) => a.name));
    const unknown = requested.filter((name) => !known.has(name));
    if (unknown.length) logger.warn(`Unknown asset(s): ${unknown.join(", ")}`);
    if (requested.every((name) => !known.has(name))) {
      logger.error("No matching assets to generate.");
      process.exitCode = 1;
      return;
    }
  }

  // Ensure a managed Chromium unless a system channel/executable is configured, or skipped.
  const usingManaged =
    !config.settings.browser.channel && !config.settings.browser.executablePath;
  if (!options.skipBrowser && usingManaged) {
    const ready = await ensureChromium({ logger });
    if (!ready) {
      logger.error("Chromium is required. Run `showcase init` or install it manually.");
      process.exitCode = 1;
      return;
    }
  }

  const concurrency = options.concurrency != null ? Number(options.concurrency) : undefined;
  const count = requested ? requested.length : config.assets.length;
  logger.start(`Generating ${count} asset(s)…`);

  const outcomes = await runPipeline({
    config,
    outDir,
    logger,
    toolVersion: TOOL_VERSION,
    assetNames: requested,
    concurrency: Number.isFinite(concurrency) ? concurrency : undefined,
  });

  printSummary(logger, outcomes, outDir);
  if (outcomes.some((outcome) => outcome.status === "failed")) {
    process.exitCode = 1;
  }
}

function normalizeAssetNames(value?: string | string[]): string[] | undefined {
  if (value == null) return undefined;
  const arr = (Array.isArray(value) ? value : [value]).map(String).filter(Boolean);
  return arr.length ? arr : undefined;
}
