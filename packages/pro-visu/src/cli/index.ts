#!/usr/bin/env node
import { cac } from "cac";
import { TOOL_VERSION } from "@/version";
import { checkForUpdates, runUpdateWorker, UPDATE_WORKER_FLAG } from "@/cli/update-check";
import { runInit } from "@/cli/commands/init";
import { runGenerate } from "@/cli/commands/generate";
import { runDoctor } from "@/cli/commands/doctor";
import { runList } from "@/cli/commands/list";

const cli = cac("pro-visu");

cli
  .command("init", "Scaffold config, gitignore the output dir, and ensure a browser")
  .option("--cwd <dir>", "Working directory")
  .option("--no-script", 'Skip adding the "pro-visu" script to package.json')
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
  .option("--verbose", "Verbose (debug) logging (plain logs instead of the live dashboard)")
  .action(runGenerate);

cli
  .command("doctor", "Check the setup and print the plan (Node, config, Chromium, ffmpeg, URLs)")
  .option("--config <path>", "Path to a config file")
  .option("--cwd <dir>", "Working directory")
  .action(runDoctor);

cli
  .command("list", "List assets recorded in the manifest")
  .alias("ls")
  .option("--config <path>", "Path to a config file")
  .option("--cwd <dir>", "Working directory")
  .option("--json", "Print the manifest as JSON (for scripts/CI)")
  .action(runList);

cli.help();
cli.version(TOOL_VERSION);

const parsed = cli.parse(process.argv, { run: false });

async function main(): Promise<void> {
  // A detached invocation of ourselves refreshes the update-check cache, then exits.
  if (process.env[UPDATE_WORKER_FLAG] === "1") {
    await runUpdateWorker();
    return;
  }
  // Fire-and-forget: arms a deferred "newer version on npm" notice (best-effort, non-blocking).
  checkForUpdates();
  if (!cli.matchedCommand) {
    // An unrecognized command is an error (exit 1), not a silent help dump — scripts must notice.
    if (parsed.args.length > 0) {
      console.error(`Unknown command "${parsed.args[0]}". Run \`pro-visu --help\` for the command list.`);
      process.exitCode = 1;
      return;
    }
    // --help / --version were already handled by parse(); otherwise show help.
    if (!parsed.options.help && !parsed.options.version) cli.outputHelp();
    return;
  }
  await cli.runMatchedCommand();
}

main().catch((err: unknown) => {
  process.exitCode = 1;
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  if (!process.argv.includes("--verbose") && err instanceof Error && err.stack) {
    console.error("Re-run with --verbose for a stack trace.");
  } else if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
});
