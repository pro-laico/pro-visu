import pc from "picocolors";
import { resolveCwd, resolveOutDir } from "@/utils/paths";
import { createLogger } from "@/utils/logger";
import { loadShowcaseConfig, ConfigNotFoundError } from "@/config/load";
import { readManifest } from "@/manifest/manifest";
import { DEFAULT_OUTDIR } from "@/config/defaults";
import { reportConfigError } from "@/cli/ui";
import { formatBytes } from "@/utils/format";

export interface ListOptions {
  cwd?: string;
  config?: string;
}

export async function runList(options: ListOptions = {}): Promise<void> {
  const cwd = resolveCwd(options.cwd);
  const logger = createLogger("info");

  let outDir: string;
  try {
    const { config } = await loadShowcaseConfig({ cwd, configFile: options.config });
    outDir = resolveOutDir(cwd, config.settings.outDir);
  } catch (err) {
    if (err instanceof ConfigNotFoundError) {
      outDir = resolveOutDir(cwd, DEFAULT_OUTDIR);
    } else {
      reportConfigError(logger, err);
      process.exitCode = 1;
      return;
    }
  }

  const manifest = await readManifest(outDir);
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
