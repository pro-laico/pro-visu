import pc from "picocolors";

import { reportConfigError } from "@/cli/ui";
import { formatBytes } from "@/utils/format";
import { createLogger } from "@/utils/logger";
import type { LogLevel } from "@/config/schema";
import { readManifest } from "@/manifest/manifest";
import { DEFAULT_OUTDIR } from "@/config/defaults";
import { loadShowcaseConfig, ConfigNotFoundError } from "@/config/load";
import { resolveCwd, resolveConfigDir, resolveOutDir } from "@/utils/paths";

export interface ListOptions {
  cwd?: string;
  config?: string;
  /** Print the manifest as JSON (machine-readable, for scripts/CI). */
  json?: boolean;
}

export async function runList(options: ListOptions = {}): Promise<void> {
  const cwd = resolveCwd(options.cwd);
  const bootstrap = createLogger("info");

  let outDir: string;
  let logLevel: LogLevel = "info";
  try {
    const { config, configFile } = await loadShowcaseConfig({ cwd, configFile: options.config });
    outDir = resolveOutDir(resolveConfigDir(cwd, configFile), config.settings.outDir);
    logLevel = config.settings.logLevel;
  } catch (err) {
    if (err instanceof ConfigNotFoundError) {
      outDir = resolveOutDir(resolveConfigDir(cwd), DEFAULT_OUTDIR);
    } else {
      reportConfigError(bootstrap, err);
      process.exitCode = 1;
      return;
    }
  }
  const logger = createLogger(logLevel);

  const manifest = await readManifest(outDir);
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ outDir, assets: manifest.assets }, null, 2)}\n`);
    return;
  }
  if (manifest.assets.length === 0) {
    logger.info("Nothing generated yet. Run `pro-visu generate`.");
    return;
  }

  logger.log(pc.bold(`Assets in ${outDir}:`));
  logger.log("");
  for (const asset of manifest.assets) {
    logger.log(
      `  ${pc.bold(asset.id)}  ${pc.dim(asset.generator)}  ${pc.cyan(asset.file)}  ` +
        `${pc.dim(`${asset.width}×${asset.height}`)}  ${pc.dim(formatBytes(asset.bytes))}`,
    );
  }
  logger.log("");
  logger.log(pc.dim(`${manifest.assets.length} asset(s)`));
}
