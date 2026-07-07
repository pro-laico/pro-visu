import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolveCwd } from "@/utils/paths";
import { ensureDir, ensureGitignoreEntry, pathExists } from "@/utils/fs";
import { createLogger } from "@/utils/logger";
import { ensureChromium } from "@/binaries/chromium";
import { ensureFfmpeg } from "@/binaries/ensure-ffmpeg";
import { DEFAULT_OUTDIR } from "@/config/defaults";
import { serializeConfigJsonSchema, DEFAULT_SCHEMA_FILE } from "@/config/json-schema";

const CONFIG_FILES = [
  "pro-visu.config.ts",
  "pro-visu.config.js",
  "pro-visu.config.mjs",
  "pro-visu.config.cjs",
  "pro-visu.config.json",
  ".pro-visurc",
  ".pro-visurc.json",
];

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

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
    pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8")) as Record<string, unknown>;
  } catch {
    /* no/unparseable package.json — fall back to plain defaults */
  }

  const pmField = typeof pkg.packageManager === "string" ? pkg.packageManager.split("@")[0] : "";
  const pm: PackageManager =
    pmField === "pnpm" || pmField === "yarn" || pmField === "bun" || pmField === "npm"
      ? pmField
      : existsSync(path.join(cwd, "pnpm-lock.yaml"))
        ? "pnpm"
        : existsSync(path.join(cwd, "yarn.lock"))
          ? "yarn"
          : existsSync(path.join(cwd, "bun.lockb")) || existsSync(path.join(cwd, "bun.lock"))
            ? "bun"
            : "npm";

  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };
  const match = FRAMEWORKS.find(([dep]) => deps[dep]);
  // An explicit port flag in the dev script beats the framework's conventional default.
  const devScript = (pkg.scripts as Record<string, string> | undefined)?.dev ?? "";
  const flag = /(?:-p|--port)[ =](\d{2,5})/.exec(devScript);
  const devPort = flag ? Number(flag[1]) : match?.[2];

  // Resolve like the config loader will: through the project's node_modules (walking up), so
  // monorepo hoisting counts. No resolution → a TS config's `import "pro-visu"` would fail.
  let localDep = false;
  try {
    createRequire(path.join(cwd, "package.json")).resolve("pro-visu/package.json");
    localDep = true;
  } catch {
    localDep = false;
  }

  return { pm, framework: match?.[1], devPort, localDep };
}

/** The project's own run command for a script ("npm run build" / "pnpm build" / …). */
function runCmd(pm: PackageManager, script: string): string {
  return pm === "npm" ? `npm run ${script}` : `${pm} ${script}`;
}

function tsConfigTemplate(info: ProjectInfo): string {
  const port = info.devPort ?? 3101;
  const urlComment = info.devPort
    ? `// Your ${info.framework} dev server's URL — start it (\`${runCmd(info.pm, "dev")}\`) before generating,\n` +
      `// point this at a deployed site, or enable the managed \`server\` block below instead.`
    : "// URL the capture assets point at — your running site, a deployed URL, or the managed server below.";
  const start = info.pm === "npm" ? "npm start" : `${info.pm} start`;
  return `import { defineConfig } from "pro-visu";

${urlComment}
const URL = "http://localhost:${port}";

export default defineConfig({
  settings: {
    outDir: "pro-visu",
    concurrency: 2,
    // Uses Playwright's managed Chromium by default. Set channel: "chrome" to use your
    // installed Chrome, or args: ["--no-sandbox"] on CI.
    browser: { headless: true },
    // Optional: let the tool build + start your site, wait for it, capture, then stop it.
    // PORT is set in the command's env (default 3101), so PORT-honoring frameworks bind it
    // automatically. If you enable this, point URL above at the same port.
    // server: {
    //   build: "${runCmd(info.pm, "build")}",
    //   command: "${start}",
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
      // options: { durationMs: 7000, waitForSelector: "main" },
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

// A dependency-free JSON config + a sibling JSON Schema (for editor autocomplete). Used when
// running the tool via npx / a global install rather than as a project dev-dependency.
function jsonConfigTemplate(info: ProjectInfo): string {
  const port = info.devPort ?? 3101;
  return `{
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
  // A TS config imports "pro-visu", which only resolves when the package is installed in the
  // project. Running via npx/global? Fall back to the dependency-free JSON config automatically.
  let useJson = Boolean(options.json);
  if (!useJson && !info.localDep) {
    useJson = true;
    logger.info("pro-visu isn't a local dependency — scaffolding a JSON config (works via npx/global)");
  }
  const configFile = useJson ? "pro-visu.config.json" : "pro-visu.config.ts";

  // 1. Config file
  const existingConfig = findExistingConfig(cwd);
  if (existingConfig) {
    logger.info(`config exists (${existingConfig}) — leaving it untouched`);
  } else if (useJson) {
    await writeFile(path.join(cwd, configFile), jsonConfigTemplate(info), "utf8");
    logger.success(`created ${configFile}`);
    // Materialize the matching JSON Schema so the JSON config gets editor autocomplete + validation
    // with no dependency on this package — it works the same whether run via npx, global, or a dep.
    await writeFile(path.join(cwd, DEFAULT_SCHEMA_FILE), serializeConfigJsonSchema(), "utf8");
    logger.success(`created ${DEFAULT_SCHEMA_FILE}`);
    createdSomething = true;
  } else {
    await writeFile(path.join(cwd, configFile), tsConfigTemplate(info), "utf8");
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
  const startHint = info.devPort
    ? `start your dev server (\`${runCmd(info.pm, "dev")}\`)`
    : "start your site (or point the config at a deployed URL)";
  logger.info(
    createdSomething
      ? `Next: edit ${configFile}, ${startHint}, then run \`pro-visu generate\`. (\`pro-visu doctor\` checks the setup.)`
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
