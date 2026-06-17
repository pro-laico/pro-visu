#!/usr/bin/env node
import { cac } from "cac";
import { TOOL_VERSION } from "@/version";
import { checkForUpdates } from "@/cli/update-check";
import { runInit } from "@/cli/commands/init";
import { runGenerate } from "@/cli/commands/generate";
import { runList } from "@/cli/commands/list";
import { runReset } from "@/cli/commands/reset";
import { runSchema } from "@/cli/commands/schema";

const cli = cac("pro-visu");

cli
  .command("init", "Scaffold config, gitignore the output dir, and ensure a browser")
  .option("--cwd <dir>", "Working directory")
  .option("--no-script", "Do not add a package.json script")
  .option("--skip-browser", "Do not install Chromium")
  .option("--json", "Scaffold a dependency-free JSON config + JSON Schema (for npx / global use)")
  .action(runInit);

cli
  .command("generate", "Generate showcase assets defined in your config")
  .alias("gen")
  .option("--config <path>", "Path to a config file")
  .option("--cwd <dir>", "Working directory")
  .option("--asset <name>", "Only generate these assets (repeatable)")
  .option("--concurrency <n>", "Override parallelism")
  .option("--skip-browser", "Skip the Chromium check/install")
  .option("--skip-server", "Skip the managed server (use an already-running site)")
  .option("--skip-build", "Skip the server build step (fast iteration when the site is unchanged)")
  .option("--draft", "Draft quality: faster, lower-fidelity renders for iteration")
  .option("--cache", "Skip assets whose inputs+options are unchanged")
  .option("--verbose", "Verbose (debug) logging")
  .action(runGenerate);

cli
  .command("list", "List assets recorded in the manifest")
  .alias("ls")
  .option("--config <path>", "Path to a config file")
  .option("--cwd <dir>", "Working directory")
  .action(runList);

cli
  .command("schema", "Write a JSON Schema for pro-visu.config.json (editor autocomplete)")
  .option("--cwd <dir>", "Working directory")
  .option("--out <path>", "Output path (default pro-visu.schema.json)")
  .action(runSchema);

cli
  .command("reset", "Clean up orphaned processes/temp from an interrupted run")
  .option("--config <path>", "Path to a config file")
  .option("--cwd <dir>", "Working directory")
  .option("--force", "Clean up even if a run still looks active")
  .action(runReset);

cli.help();
cli.version(TOOL_VERSION);

const parsed = cli.parse(process.argv, { run: false });

async function main(): Promise<void> {
  // Fire-and-forget: arms a deferred "newer version on npm" notice (best-effort, non-blocking).
  checkForUpdates();
  if (!cli.matchedCommand) {
    // --help / --version were already handled by parse(); otherwise show help.
    if (!parsed.options.help && !parsed.options.version) cli.outputHelp();
    return;
  }
  await cli.runMatchedCommand();
}

main().catch((err: unknown) => {
  process.exitCode = 1;
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
