import { parseArgs } from "node:util";
import { stdin, stdout } from "node:process";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Cut a release: bump the publishable package's version, commit, and tag — then
 * `git push --follow-tags` triggers .github/workflows/release.yml, which publishes
 * to npm via Trusted Publishing (OIDC). Modeled on atomic-payload's tools/releaser.
 * Plain Node ESM — no dependencies, runs with `node`.
 *
 * Usage (from repo root):
 *   pnpm release                              # patch bump, interactive confirm
 *   pnpm release --bump minor
 *   pnpm release --bump prerelease --preid beta
 *   pnpm release --dry-run
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PKG_JSON = path.join(REPO_ROOT, "packages", "pro-visu", "package.json");
const RELEASE_TYPES = ["patch", "minor", "major", "prerelease"];

/** Pure SemVer increment — no external deps. */
function incVersion(current, type, preid) {
  const [core, pre] = current.split("-");
  const parts = core.split(".").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`[releaser] Unparseable version: "${current}"`);
  }
  const [major, minor, patch] = parts;
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "prerelease": {
      const prefix = `${preid}.`;
      if (pre?.startsWith(prefix)) {
        const n = Number(pre.slice(prefix.length));
        return `${major}.${minor}.${patch}-${preid}.${Number.isNaN(n) ? 0 : n + 1}`;
      }
      return `${major}.${minor}.${patch + 1}-${preid}.0`;
    }
    default:
      throw new Error(`[releaser] Invalid bump: ${type}`);
  }
}

/** Replace only the top-level "version" string, preserving all other formatting. */
function stampVersion(pkgJsonPath, next) {
  const text = readFileSync(pkgJsonPath, "utf8");
  const updated = text.replace(/("version":\s*")[^"]*(")/, `$1${next}$2`);
  if (updated === text) throw new Error(`[releaser] No "version" field found in ${pkgJsonPath}`);
  writeFileSync(pkgJsonPath, updated);
}

async function confirm(question) {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(`${question} (y/N) `)).trim().toLowerCase();
  rl.close();
  return answer === "y" || answer === "yes";
}

function git(args) {
  execFileSync("git", args, { cwd: REPO_ROOT, stdio: "inherit" });
}

async function main() {
  const { values } = parseArgs({
    options: {
      bump: { type: "string", default: "patch" },
      preid: { type: "string", default: "beta" },
      "dry-run": { type: "boolean", default: false },
      yes: { type: "boolean", default: false },
      "skip-git": { type: "boolean", default: false },
    },
  });

  const bump = values.bump;
  if (!RELEASE_TYPES.includes(bump)) {
    console.error(`[releaser] Invalid --bump "${bump}". Expected one of: ${RELEASE_TYPES.join(", ")}`);
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(PKG_JSON, "utf8"));
  const current = pkg.version;
  const next = incVersion(current, bump, values.preid);

  console.log(`\n${pkg.name}:  ${current}  ->  ${next}  (${bump})\n`);

  if (values["dry-run"]) {
    console.log("Dry run — no files written, no git operations.\n");
    return;
  }

  if (!values.yes && !(await confirm(`Stamp v${next}${values["skip-git"] ? "" : ", commit, and tag"}?`))) {
    console.log("Aborted.");
    return;
  }

  stampVersion(PKG_JSON, next);
  console.log(`✓ Stamped v${next} into ${pkg.name}.`);

  if (!values["skip-git"]) {
    git(["add", "-A"]);
    git(["commit", "-m", `chore(release): v${next}`]);
    git(["tag", "-a", `v${next}`, "-m", `v${next}`]);
    console.log(`✓ Committed and tagged v${next}.`);
    console.log("  Push with:  git push --follow-tags");
  }
  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
