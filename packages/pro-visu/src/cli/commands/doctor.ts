import { existsSync } from "node:fs";

import { reportConfigError } from "@/cli/ui";
import { createLogger } from "@/utils/logger";
import { loadShowcaseConfig } from "@/config/load";
import { ensureChromium } from "@/binaries/chromium";
import { getGenerator } from "@/generators/registry";
import type { ResolvedConfig } from "@/config/schema";
import { applyDerivedInputs } from "@/pipeline/runner";
import { ensureFfmpeg } from "@/binaries/ensure-ffmpeg";
import { refreshSchemaFile } from "@/config/json-schema";
import { resolveTargets } from "@/config/resolve-targets";
import { resolveServerUrl } from "@/server/manage-server";
import { resolveCwd, resolveConfigDir } from "@/utils/paths";
import { ffmpegIsSupported } from "@/binaries/ffmpeg-binary";
import { buildGraph, resolveSelection } from "@/pipeline/graph";
import { detectPackageManager, pmRun } from "@/utils/package-manager";
import { validatePlan, preflightUrls } from "@/cli/commands/generate";

export interface DoctorOptions {
  cwd?: string;
  config?: string;
}

/**
 * Diagnose the environment + config without generating anything: Node version, config discovery
 * and validation (including every asset's generator options), the dependency graph, Chromium,
 * ffmpeg, the resolved plan (each asset + its URL + the server decision), and — when no managed
 * server is configured — whether the asset URLs actually respond. Exits non-zero when something
 * needs fixing, so it also works as a CI gate.
 */
export async function runDoctor(options: DoctorOptions = {}): Promise<void> {
  const cwd = resolveCwd(options.cwd);
  const log = createLogger("info");
  let failed = false;
  const fail = (message: string): void => {
    failed = true;
    log.error(message);
  };

  const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
  if (major > 18 || (major === 18 && minor >= 18)) {
    log.success(`Node ${process.versions.node}`);
  } else {
    fail(`Node ${process.versions.node} — pro-visu requires >= 18.18.`);
  }

  let config: ResolvedConfig | undefined;
  let configFile: string | undefined;
  try {
    const loaded = await loadShowcaseConfig({ cwd, configFile: options.config });
    config = loaded.config;
    configFile = loaded.configFile;
    const where = loaded.configFile ?? "pro-visu config";
    log.success(`Config OK (${where}) — ${config.assets.length} asset(s).`);
  } catch (err) {
    failed = true;
    reportConfigError(log, err);
  }
  await refreshSchemaFile(resolveConfigDir(cwd, configFile), log);
  if (config) {
    if (validatePlan(log, config, config.assets, "final")) {
      log.success("Asset options OK.");
    } else {
      failed = true;
    }
    try {
      applyDerivedInputs(config);
      buildGraph(config.assets);
    } catch (err) {
      fail((err as Error).message); //TODO: replace `as` cast with proper typing
    }
  }

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

  if (await ensureFfmpeg({ logger: log, checkOnly: true })) {
    log.success(`ffmpeg OK${process.env.FFMPEG_BIN ? " (FFMPEG_BIN)" : ""}.`);
  } else if (ffmpegIsSupported()) {
    log.warn("ffmpeg not fetched yet — it downloads automatically on first `pro-visu generate`.");
  } else {
    fail(`No prebuilt ffmpeg for ${process.platform}/${process.arch} — set FFMPEG_BIN to a local ffmpeg binary.`);
  }

  if (config) {
    const serverCfg = config.settings.server;
    const serverBase = serverCfg ? resolveServerUrl(serverCfg) : undefined;
    const resolved = resolveTargets(config.assets, serverBase, (id) => Boolean(getGenerator(id)?.requiresUrl));
    const willRun = new Set(resolveSelection(resolved, undefined, config.settings.enabled).map((a) => a.name));
    const { enabled } = config.settings;
    const enabledNote =
      enabled === true
        ? ""
        : enabled === false
          ? " — settings.enabled: false (nothing runs)"
          : ` — settings.enabled: "${enabled}" (group)`;
    log.info(
      `Plan: ${willRun.size}/${resolved.length} asset(s) run, concurrency ${config.settings.concurrency}${enabledNote}`,
    );
    for (const a of resolved) {
      const tag = typeof a.enabled === "string" ? `  (group "${a.enabled}")` : a.enabled === false ? "  (disabled)" : "";
      const mark = willRun.has(a.name) ? "•" : "·";
      log.log(`  ${mark} ${a.name}  [${a.generator}]${a.url ? `  ${a.url}` : ""}${tag}`);
    }

    if (serverCfg) {
      const pm = detectPackageManager(cwd);
      const startCmd = serverCfg.command ?? pmRun(pm, "start");
      const buildCmd = serverCfg.build === false ? "skipped" : `\`${serverCfg.build ?? pmRun(pm, "build")}\``;
      log.info(`Managed server: build ${buildCmd}, start \`${startCmd}\` (started per run).`);
    } else if (await preflightUrls(log, { ...config, assets: resolved }, resolved)) {
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
