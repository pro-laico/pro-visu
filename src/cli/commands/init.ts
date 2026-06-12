import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolveCwd } from "@/utils/paths";
import { ensureDir, ensureGitignoreEntry, pathExists } from "@/utils/fs";
import { createLogger } from "@/utils/logger";
import { ensureChromium } from "@/browser-install/ensure-chromium";
import { ensureFfmpeg } from "@/media/ensure-ffmpeg";
import { DEFAULT_OUTDIR } from "@/config/defaults";

const CONFIG_FILES = [
  "showcase.config.ts",
  "showcase.config.js",
  "showcase.config.mjs",
  "showcase.config.cjs",
  "showcase.config.json",
  ".showcaserc",
  ".showcaserc.json",
];

const CONFIG_TEMPLATE = `import { defineConfig } from "auto-showcase";

export default defineConfig({
  settings: {
    outDir: "showcase",
    concurrency: 2,
    // Uses Playwright's managed Chromium by default. Set channel: "chrome" to use your
    // installed Chrome, or args: ["--no-sandbox"] on CI.
    browser: { headless: true },
    defaults: {
      // Keyed by generator id. Merged underneath each asset's own options.
      "scroll-reel": { width: 1440, height: 900, fps: 30 },
    },
  },
  assets: [
    {
      name: "home-reel",
      url: "http://localhost:3000",
      generator: "scroll-reel",
      // options: { duration: 7000, waitForSelector: "main" },
    },
  ],
});
`;

export interface InitOptions {
  cwd?: string;
  /** --no-script sets this to false. */
  script?: boolean;
  skipBrowser?: boolean;
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  const cwd = resolveCwd(options.cwd);
  const logger = createLogger("info");
  let createdSomething = false;

  // 1. Config file
  const existingConfig = findExistingConfig(cwd);
  if (existingConfig) {
    logger.info(`config exists (${existingConfig}) — leaving it untouched`);
  } else {
    await writeFile(path.join(cwd, "showcase.config.ts"), CONFIG_TEMPLATE, "utf8");
    logger.success("created showcase.config.ts");
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
      logger.success('added "showcase" script to package.json');
      createdSomething = true;
    } else if (result === "exists") {
      logger.info('"showcase" script already present');
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
      logger.warn("It will be installed on first `showcase generate`.");
    }
    try {
      await ensureFfmpeg({ logger });
    } catch (err) {
      logger.warn(`Could not fetch ffmpeg now: ${(err as Error).message}`);
      logger.warn("It will be fetched on first `showcase generate`.");
    }
  }

  logger.log("");
  logger.info(
    createdSomething
      ? "Next: edit showcase.config.ts, start your site (or use a deployed URL), then run `showcase generate`."
      : "Already initialized. Edit showcase.config.ts, then run `showcase generate`.",
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
      if (pkg && typeof pkg === "object" && "showcase" in pkg) {
        return 'package.json "showcase" key';
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
  if (pkg.scripts.showcase) return "exists";
  pkg.scripts.showcase = "showcase generate";
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return "added";
}
