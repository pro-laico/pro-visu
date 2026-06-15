import { parseArgs } from "node:util";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Publish the package to npm. Run by .github/workflows/release.yml on a `v*` tag
 * (Trusted Publishing / OIDC, with provenance), or locally for the FIRST publish
 * (`npm login` then `pnpm publish-packages`). Versions already on the registry are
 * skipped, so re-running after a partial failure is safe. Modeled on atomic-payload.
 * Plain Node ESM — no dependencies, runs with `node`.
 *
 * Usage (from repo root):
 *   pnpm publish-packages --dry-run            # build + pack, no upload
 *   pnpm publish-packages                      # publish at dist-tag "latest"
 *   pnpm publish-packages --tag beta
 *   pnpm publish-packages --provenance --yes   # CI: signed provenance, no prompt
 */

// pnpm/npm are `.cmd` shims on Windows, which Node can only launch via a shell.
const RUN_OPTS = { shell: true };
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PKG_DIR = path.join(REPO_ROOT, "packages", "auto-showcase");

/** Is `name@version` already on the npm registry? */
function isPublished(name, version) {
  try {
    const out = execFileSync("npm", ["view", `${name}@${version}`, "version"], {
      ...RUN_OPTS,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out === version;
  } catch {
    // `npm view` exits non-zero when the package/version doesn't exist yet.
    return false;
  }
}

async function publishWithRetry(args, cwd, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      execFileSync("pnpm", args, { ...RUN_OPTS, cwd, stdio: "inherit" });
      return true;
    } catch {
      if (attempt < retries) {
        console.warn(`  publish failed — retrying (${attempt + 1}/${retries})…`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  return false;
}

async function confirm(question) {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(`${question} (y/N) `)).trim().toLowerCase();
  rl.close();
  return answer === "y" || answer === "yes";
}

async function main() {
  const { values } = parseArgs({
    options: {
      tag: { type: "string", default: "latest" },
      "dry-run": { type: "boolean", default: false },
      provenance: { type: "boolean", default: false },
      yes: { type: "boolean", default: false },
    },
  });

  const dryRun = values["dry-run"];
  const tag = values.tag;
  if (!/^[a-zA-Z0-9._-]+$/.test(tag)) {
    console.error(`[releaser] Invalid --tag "${tag}". Use letters, numbers, ".", "_", "-".`);
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(path.join(PKG_DIR, "package.json"), "utf8"));
  const already = !dryRun && isPublished(pkg.name, pkg.version);

  console.log(
    `\n${dryRun ? "Dry-run publish" : "Publish"} — dist-tag "${tag}"${values.provenance ? ", with provenance" : ""}:`,
  );
  console.log(`  ${pkg.name}@${pkg.version}${already ? "   (already on npm — skip)" : ""}\n`);

  if (already) {
    console.log("Nothing to publish — this version is already on the registry.\n");
    return;
  }

  if (!dryRun && !values.yes && !(await confirm(`Publish ${pkg.name}@${pkg.version} to npm at "${tag}"?`))) {
    console.log("Aborted.");
    return;
  }

  const args = ["publish", "--access", "public", "--no-git-checks", "--tag", tag];
  if (values.provenance) args.push("--provenance");
  if (dryRun) args.push("--dry-run");

  console.log(`→ ${pkg.name}@${pkg.version}`);
  if (!(await publishWithRetry(args, PKG_DIR))) {
    console.error(`\n✗ Failed to publish ${pkg.name}.`);
    process.exit(1);
  }
  console.log(`\n✓ ${dryRun ? "Dry-run complete" : `Published ${pkg.name}@${pkg.version}`} at "${tag}".\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
