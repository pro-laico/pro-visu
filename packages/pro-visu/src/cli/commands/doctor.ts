import { existsSync } from "node:fs";
import { resolveCwd } from "@/utils/paths";
import { createLogger } from "@/utils/logger";
import { loadShowcaseConfig } from "@/config/load";
import type { ResolvedConfig } from "@/config/schema";
import { ensureChromium } from "@/browser-install/ensure-chromium";
import { ensureFfmpeg } from "@/media/ensure-ffmpeg";
import { ffmpegIsSupported } from "@/media/ffmpeg-binary";
import { applyDerivedInputs } from "@/pipeline/runner";
import { buildGraph } from "@/pipeline/graph";
import { reportConfigError } from "@/cli/ui";
import { validatePlan, preflightUrls } from "@/cli/commands/generate";

export interface DoctorOptions {
  cwd?: string;
  config?: string;
}

/**
 * Diagnose the environment + config without generating anything: Node version, config discovery
 * and validation (including every asset's generator options), the dependency graph, Chromium,
 * ffmpeg, and — when no managed server is configured — whether the asset URLs actually respond.
 * Exits non-zero when something needs fixing.
 */
export async function runDoctor(options: DoctorOptions = {}): Promise<void> {
  const cwd = resolveCwd(options.cwd);
  const log = createLogger("info");
  let failed = false;
  const fail = (message: string): void => {
    failed = true;
    log.error(message);
  };

  // Node version (mirrors package.json engines).
  const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
  if (major > 18 || (major === 18 && minor >= 18)) {
    log.success(`Node ${process.versions.node}`);
  } else {
    fail(`Node ${process.versions.node} — pro-visu requires >= 18.18.`);
  }

  // Config: discovery, schema validation, per-asset options, and the dependency graph.
  let config: ResolvedConfig | undefined;
  try {
    const loaded = await loadShowcaseConfig({ cwd, configFile: options.config });
    config = loaded.config;
    const where = loaded.configFile ?? 'package.json "pro-visu" key';
    log.success(`Config OK (${where}) — ${config.assets.length} asset(s).`);
  } catch (err) {
    failed = true;
    reportConfigError(log, err);
  }
  if (config) {
    if (validatePlan(log, config, config.assets, config.settings.quality)) {
      log.success("Asset options OK.");
    } else {
      failed = true;
    }
    try {
      applyDerivedInputs(config);
      buildGraph(config.assets);
    } catch (err) {
      fail((err as Error).message);
    }
  }

  // Browser: verify whichever launch path the config selects.
  const browser = config?.settings.browser;
  if (browser?.executablePath) {
    if (existsSync(browser.executablePath)) log.success(`Browser executable: ${browser.executablePath}`);
    else fail(`browser.executablePath not found: ${browser.executablePath}`);
  } else if (browser?.channel) {
    log.info(`Browser channel "${browser.channel}" — verified at launch.`);
  } else if (await ensureChromium({ logger: log, checkOnly: true })) {
    log.success("Chromium installed.");
  } else {
    fail("Chromium missing — run `pro-visu init` (or it installs on first `pro-visu generate`).");
  }

  // ffmpeg: missing is self-healing on generate, so it's only fatal on unsupported platforms.
  if (await ensureFfmpeg({ logger: log, checkOnly: true })) {
    log.success(`ffmpeg OK${process.env.FFMPEG_BIN ? " (FFMPEG_BIN)" : ""}.`);
  } else if (ffmpegIsSupported()) {
    log.warn("ffmpeg not fetched yet — it downloads automatically on first `pro-visu generate`.");
  } else {
    fail(
      `No prebuilt ffmpeg for ${process.platform}/${process.arch} — set FFMPEG_BIN to a local ffmpeg binary.`,
    );
  }

  // Capture targets: a managed server is started per run; otherwise the URLs must already respond.
  if (config) {
    if (config.settings.server) {
      log.info(`Managed server configured: \`${config.settings.server.command}\` (started per run).`);
    } else if (await preflightUrls(log, config, config.assets)) {
      log.success("Asset URLs respond.");
    } else {
      failed = true;
    }
  }

  log.log("");
  if (failed) {
    log.error("Some checks failed — see above.");
    process.exitCode = 1;
  } else {
    log.success("All checks passed. Run `pro-visu generate` when ready.");
  }
}
