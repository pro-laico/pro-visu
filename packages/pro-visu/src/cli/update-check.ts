import updateNotifier from "update-notifier";
import { TOOL_VERSION } from "@/version";

const PKG_NAME = "pro-visu";

/**
 * Best-effort "a newer version is on npm" notice.
 *
 * update-notifier does the registry lookup in a detached, unref'd background process and persists
 * the result, so this call never blocks, slows, or fails a command — it just reads the previous
 * run's cached result and, if a newer version exists, prints a notice when the process exits.
 *
 * It self-suppresses where a notice would be unwelcome: in CI, in non-interactive (non-TTY) output,
 * when `NO_UPDATE_NOTIFIER` is set, with the `--no-update-notifier` flag, under `NODE_ENV=test`, or
 * when the user has opted out via configstore. We additionally skip the unpublished dev build, which
 * has no meaningful version to compare against.
 */
export function checkForUpdates(version: string = TOOL_VERSION): void {
  if (version === "0.0.0-dev") return;
  try {
    updateNotifier({
      pkg: { name: PKG_NAME, version },
      // Most people run `pro-visu` from a package.json script — surface the notice there too.
      shouldNotifyInNpmScript: true,
    }).notify({
      // Defer so the notice prints after the command finishes (the last thing on screen).
      defer: true,
      // {updateCommand} is install-mode aware (update-notifier detects global vs local), so the
      // suggested command is right whether the tool is a dev-dep or a global install.
      message: "Update available {currentVersion} → {latestVersion}\nRun {updateCommand} to update",
    });
  } catch {
    // An update check must never break the CLI.
  }
}
