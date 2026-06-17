import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolveCwd } from "@/utils/paths";
import { ensureDir, ensureGitignoreEntry, pathExists } from "@/utils/fs";
import { createLogger } from "@/utils/logger";
import { ensureChromium } from "@/browser-install/ensure-chromium";
import { ensureFfmpeg } from "@/media/ensure-ffmpeg";
import { DEFAULT_OUTDIR } from "@/config/defaults";
import { serializeConfigJsonSchema } from "@/config/json-schema";
import { DEFAULT_SCHEMA_FILE } from "@/cli/commands/schema";

const CONFIG_FILES = [
  "pro-visu.config.ts",
  "pro-visu.config.js",
  "pro-visu.config.mjs",
  "pro-visu.config.cjs",
  "pro-visu.config.json",
  ".pro-visurc",
  ".pro-visurc.json",
];

const CONFIG_TEMPLATE = `import { defineConfig } from "pro-visu";

// URL the capture assets point at. The optional managed server (below) binds this port.
const URL = "http://localhost:3101";

export default defineConfig({
  settings: {
    outDir: "pro-visu",
    concurrency: 2,
    // Uses Playwright's managed Chromium by default. Set channel: "chrome" to use your
    // installed Chrome, or args: ["--no-sandbox"] on CI.
    browser: { headless: true },
    // Optional: let the tool build + start your site, wait for it, capture, then stop it.
    // 'port' defaults to 3101 (off the common 3000 dev port); your command must bind it.
    // server: {
    //   build: "npm run build",
    //   command: "npm start -- -p 3101", // e.g. Next: "npx next start -p 3101"
    //   port: 3101,
    // },
    defaults: {
      // Keyed by generator id. Merged underneath each asset's own options.
      "scroll-reel": { width: 1440, height: 900, fps: 30 },
    },
  },
  assets: [
    {
      name: "home-reel",
      url: URL,
      generator: "scroll-reel",
      // options: { duration: 7000, waitForSelector: "main" },
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

// A dependency-free JSON config + a sibling JSON Schema (for editor autocomplete). Use this when
// running the tool via npx / a global install rather than as a project dev-dependency.
const JSON_CONFIG_TEMPLATE = `{
  "$schema": "./${DEFAULT_SCHEMA_FILE}",
  "settings": {
    "outDir": "pro-visu",
    "concurrency": 2,
    "browser": { "headless": true },
    "defaults": {
      "scroll-reel": { "width": 1440, "height": 900, "fps": 30 }
    }
  },
  "assets": [
    { "name": "home-reel", "url": "http://localhost:3101", "generator": "scroll-reel" }
  ]
}
`;

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
  const configFile = options.json ? "pro-visu.config.json" : "pro-visu.config.ts";

  // 1. Config file
  const existingConfig = findExistingConfig(cwd);
  if (existingConfig) {
    logger.info(`config exists (${existingConfig}) — leaving it untouched`);
  } else if (options.json) {
    await writeFile(path.join(cwd, configFile), JSON_CONFIG_TEMPLATE, "utf8");
    logger.success(`created ${configFile}`);
    // Materialize the matching JSON Schema so the JSON config gets editor autocomplete + validation
    // with no dependency on this package — it works the same whether run via npx, global, or a dep.
    await writeFile(path.join(cwd, DEFAULT_SCHEMA_FILE), serializeConfigJsonSchema(), "utf8");
    logger.success(`created ${DEFAULT_SCHEMA_FILE}`);
    createdSomething = true;
  } else {
    await writeFile(path.join(cwd, configFile), CONFIG_TEMPLATE, "utf8");
    logger.success(`created ${configFile}`);
    createdSomething = true;
  }

  // 2. Output directory
  const outDirAbs = path.join(cwd, DEFAULT_OUTDIR);
  if (await pathExists(outDirAbs)) {
    logger.info(`${DEFAULT_OUTDIR}/ exists`);
  } else {
    await ensureDir(outDirAbs);
    logger.success(`created ${DEFAULT_OUTDIR}/`);
    createdSomething = true;
  }

  // 3. .gitignore
  const gitignore = await ensureGitignoreEntry(cwd, `${DEFAULT_OUTDIR}/`);
  if (gitignore.changed) {
    logger.success(`added ${DEFAULT_OUTDIR}/ to .gitignore`);
    createdSomething = true;
  } else {
    logger.info(`.gitignore already ignores ${DEFAULT_OUTDIR}/`);
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
      logger.warn(`Could not install Chromium now: ${(err as Error).message}`);
      logger.warn("It will be installed on first `pro-visu generate`.");
    }
    try {
      await ensureFfmpeg({ logger });
    } catch (err) {
      logger.warn(`Could not fetch ffmpeg now: ${(err as Error).message}`);
      logger.warn("It will be fetched on first `pro-visu generate`.");
    }
  }

  logger.log("");
  logger.info(
    createdSomething
      ? `Next: edit ${configFile}, start your site (or use a deployed URL), then run \`pro-visu generate\`.`
      : `Already initialized. Edit ${configFile}, then run \`pro-visu generate\`.`,
  );
}

function findExistingConfig(cwd: string): string | undefined {
  for (const file of CONFIG_FILES) {
    if (existsSync(path.join(cwd, file))) return file;
  }
  const pkgPath = path.join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
      if (pkg && typeof pkg === "object" && "pro-visu" in pkg) {
        return 'package.json "pro-visu" key';
      }
    } catch {
      // ignore unparseable package.json
    }
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
