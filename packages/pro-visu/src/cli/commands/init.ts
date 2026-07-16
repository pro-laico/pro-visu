import path from "node:path";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

import { resolveCwd } from "@/utils/paths";
import { createLogger } from "@/utils/logger";
import { ensureChromium } from "@/binaries/chromium";
import { ensureFfmpeg } from "@/binaries/ensure-ffmpeg";
import { CONFIG_DIR, DEFAULT_OUTDIR } from "@/config/defaults";
import { ensureDir, ensureGitignoreEntry, pathExists } from "@/utils/fs";
import { serializeConfigJsonSchema, DEFAULT_SCHEMA_FILE } from "@/config/json-schema";
import { detectPackageManager, pmRun, type PackageManager } from "@/utils/package-manager";

const CONFIG_FILES = [
  "pro-visu.config.ts",
  "pro-visu.config.js",
  "pro-visu.config.mjs",
  "pro-visu.config.cjs",
  "pro-visu.config.json",
  ".pro-visurc",
  ".pro-visurc.json",
];

/** What init could learn about the host project, to scaffold a config that matches it. */
interface ProjectInfo {
  pm: PackageManager;
  /** Display name of the detected framework (Next.js, Vite, …), if any. */
  framework?: string;
  /** The port the project's dev server most likely binds (framework default, or an explicit script flag). */
  devPort?: number;
  /** Whether `import "pro-visu"` resolves from this project (a TS config needs it; JSON doesn't). */
  localDep: boolean;
}

/** Framework display name + conventional dev port, from package.json dependencies. */
const FRAMEWORKS: readonly [dep: string, name: string, port: number][] = [
  ["next", "Next.js", 3000],
  ["nuxt", "Nuxt", 3000],
  ["astro", "Astro", 4321],
  ["@sveltejs/kit", "SvelteKit", 5173],
  ["gatsby", "Gatsby", 8000],
  ["@remix-run/dev", "Remix", 3000],
  ["vite", "Vite", 5173],
];

/** Sniff the package manager, framework, dev port, and pro-visu install mode from the project. */
function detectProject(cwd: string): ProjectInfo {
  let pkg: Record<string, unknown> = {};
  try {
    //EXCUSE: JSON.parse returns `any`; fields are read defensively with their own casts/guards below
    pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8")) as Record<string, unknown>;
  } catch {}

  const pm = detectPackageManager(cwd);

  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined), //EXCUSE: field of a parsed package.json (unknown)
    ...(pkg.devDependencies as Record<string, string> | undefined), //EXCUSE: field of a parsed package.json (unknown)
  };
  const match = FRAMEWORKS.find(([dep]) => deps[dep]);
  const devScript = (pkg.scripts as Record<string, string> | undefined)?.dev ?? ""; //EXCUSE: field of a parsed package.json (unknown)
  const flag = /(?:-p|--port)[ =](\d{2,5})/.exec(devScript);
  const devPort = flag ? Number(flag[1]) : match?.[2];

  let localDep = false;
  try {
    createRequire(path.join(cwd, "package.json")).resolve("pro-visu/package.json");
    localDep = true;
  } catch {
    localDep = false;
  }

  return { pm, framework: match?.[1], devPort, localDep };
}

function tsConfigTemplate(info: ProjectInfo): string {
  const port = info.devPort ?? 3101;
  const urlComment = info.devPort
    ? `// Your ${info.framework} dev server's URL — start it (\`${pmRun(info.pm, "dev")}\`) before generating,\n` +
      `// point this at a deployed site, or enable the managed \`server\` block below instead.`
    : "// URL the capture assets point at — your running site, a deployed URL, or the managed server below.";
  return `import { defineConfig } from "pro-visu";

${urlComment}
const URL = "http://localhost:${port}";

export default defineConfig({
  settings: {
    // Relative to this pro-visu/ folder → renders into pro-visu/output/. Split larger configs
    // into modules under pro-visu/config/ and import them here.
    outDir: "output",
    concurrency: 1,
    // Uses Playwright's managed Chromium by default. Set channel: "chrome" to use your
    // installed Chrome, or args: ["--no-sandbox"] on CI.
    browser: { headless: true },
    // Optional managed server → \`pro-visu generate\` becomes the only command you run: the tool
    // builds, starts, waits for, captures, then stops your site. With no fields it piggybacks on
    // your package scripts — \`${pmRun(info.pm, "build")}\` then \`${pmRun(info.pm, "start")}\` — on port 3101 (PORT is
    // set in the env, so PORT-honoring frameworks bind it). Point URL above at that port, or
    // override command/build/port here. \`build: false\` skips the build step.
    // server: {},
    // Capture mode — cleanest captures. \`signals\` tell your site to render settled (kill
    // reveal-on-scroll gaps and count-up zeros — the site must read the flag); \`cleanup\` is
    // applied by the tool (no site changes needed). See /docs/configuration#capture.
    // capture: {
    //   signals: { query: { capture: "1" } },        // your site reads ?capture=1 and renders settled
    //   cleanup: { hideSelectors: ["#cookie-banner"], freezeClock: true },
    // },
    defaults: {
      // Keyed by generator id. Merged underneath each asset's own options.
      "scroll-reel": { output: { width: 1440, height: 900, fps: 30 } },
    },
  },
  assets: [
    {
      name: "home-reel",
      url: URL,
      generator: "scroll-reel",
      // options: { motion: { durationMs: 7000 }, page: { waitForSelector: "main" } },
    },
    // A looping type-specimen from a font file (no URL needed):
    // {
    //   name: "font-specimen",
    //   generator: "specimen",
    //   options: { font: "public/fonts/YourFont.woff2", name: "Your Font", template: "sweep" },
    // },
  ],
});
`;
}

function jsonConfigTemplate(info: ProjectInfo): string {
  const port = info.devPort ?? 3101;
  return `{
  "$schema": "./${DEFAULT_SCHEMA_FILE}",
  "settings": {
    "outDir": "output",
    "concurrency": 1,
    "browser": { "headless": true },
    "defaults": {
      "scroll-reel": { "output": { "width": 1440, "height": 900, "fps": 30 } }
    }
  },
  "assets": [
    { "name": "home-reel", "url": "http://localhost:${port}", "generator": "scroll-reel" }
  ]
}
`;
}

export interface InitOptions {
  cwd?: string;
  /** --no-script sets this to false. */
  script?: boolean;
  skipBrowser?: boolean;
  /** Scaffold a JSON config + JSON Schema instead of a TS `defineConfig` file. */
  json?: boolean;
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  const cwd = resolveCwd(options.cwd);
  const logger = createLogger("info");
  let createdSomething = false;

  const info = detectProject(cwd);
  if (info.framework) {
    logger.info(`detected ${info.framework} (${info.pm}${info.devPort ? `, dev port ${info.devPort}` : ""})`);
  }
  let useJson = Boolean(options.json);
  if (!useJson && !info.localDep) {
    useJson = true;
    logger.info("pro-visu isn't a local dependency — scaffolding a JSON config (works via npx/global)");
  }
  const configFile = useJson ? "pro-visu.config.json" : "pro-visu.config.ts";
  const configDir = path.join(cwd, CONFIG_DIR);
  const configPath = path.join(CONFIG_DIR, configFile);
  const ignoreEntry = `${CONFIG_DIR}/${DEFAULT_OUTDIR}/`;

  // 1. Config file (in pro-visu/)
  const existingConfig = findExistingConfig(configDir);
  if (existingConfig) {
    logger.info(`config exists (${path.join(CONFIG_DIR, existingConfig)}) — leaving it untouched`);
  } else if (useJson) {
    await ensureDir(configDir);
    await writeFile(path.join(configDir, configFile), jsonConfigTemplate(info), "utf8");
    logger.success(`created ${configPath}`);
    await writeFile(path.join(configDir, DEFAULT_SCHEMA_FILE), serializeConfigJsonSchema(), "utf8");
    logger.success(`created ${path.join(CONFIG_DIR, DEFAULT_SCHEMA_FILE)}`);
    createdSomething = true;
  } else {
    await ensureDir(configDir);
    await writeFile(path.join(configDir, configFile), tsConfigTemplate(info), "utf8");
    logger.success(`created ${configPath}`);
    createdSomething = true;
  }

  // 2. Output directory (pro-visu/output/)
  const outDirAbs = path.join(configDir, DEFAULT_OUTDIR);
  if (await pathExists(outDirAbs)) {
    logger.info(`${ignoreEntry} exists`);
  } else {
    await ensureDir(outDirAbs);
    logger.success(`created ${ignoreEntry}`);
    createdSomething = true;
  }

  // 3. .gitignore
  const gitignore = await ensureGitignoreEntry(cwd, ignoreEntry);
  if (gitignore.changed) {
    logger.success(`added ${ignoreEntry} to .gitignore`);
    createdSomething = true;
  } else {
    logger.info(`.gitignore already ignores ${ignoreEntry}`);
  }

  // 4. package.json script (opt-out via --no-script)
  if (options.script !== false) {
    const result = await addPackageScript(cwd);
    if (result === "added") {
      logger.success('added "pro-visu" script to package.json');
      createdSomething = true;
    } else if (result === "exists") {
      logger.info('"pro-visu" script already present');
    } else {
      logger.info("no package.json found — skipped script wiring");
    }
  }

  // 5. Browser + ffmpeg
  if (!options.skipBrowser) {
    try {
      await ensureChromium({ logger });
    } catch (err) {
      logger.warn(`Could not install Chromium now: ${err instanceof Error ? err.message : String(err)}`);
      logger.warn("It will be installed on first `pro-visu generate`.");
    }
    try {
      await ensureFfmpeg({ logger });
    } catch (err) {
      logger.warn(`Could not fetch ffmpeg now: ${err instanceof Error ? err.message : String(err)}`);
      logger.warn("It will be fetched on first `pro-visu generate`.");
    }
  }

  logger.log("");
  const startHint = info.devPort
    ? `start your dev server (\`${pmRun(info.pm, "dev")}\`)`
    : "start your site (or point the config at a deployed URL)";
  logger.info(
    createdSomething
      ? `Next: edit ${configPath}, ${startHint}, then run \`pro-visu generate\`. (\`pro-visu doctor\` checks the setup.)`
      : `Already initialized. Edit ${configPath}, then run \`pro-visu generate\`.`,
  );
}

/** Find an existing config file inside the `pro-visu/` folder, if any. */
function findExistingConfig(configDir: string): string | undefined {
  for (const file of CONFIG_FILES) {
    if (existsSync(path.join(configDir, file))) return file;
  }
  return undefined;
}

async function addPackageScript(cwd: string): Promise<"added" | "exists" | "none"> {
  const pkgPath = path.join(cwd, "package.json");
  if (!existsSync(pkgPath)) return "none";

  const raw = await readFile(pkgPath, "utf8");
  let pkg: { scripts?: Record<string, string> } & Record<string, unknown>;
  try {
    pkg = JSON.parse(raw);
  } catch {
    return "none";
  }

  pkg.scripts ??= {};
  if (pkg.scripts["pro-visu"]) return "exists";
  pkg.scripts["pro-visu"] = "pro-visu generate";
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return "added";
}
