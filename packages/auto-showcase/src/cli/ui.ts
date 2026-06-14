import pc from "picocolors";
import { ConfigNotFoundError, ConfigValidationError } from "@/config/load";
import type { Logger } from "@/utils/logger";
import type { AssetOutcome } from "@/pipeline/runner";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

/** Print a friendly, actionable message for config load/validation errors. */
export function reportConfigError(logger: Logger, err: unknown): void {
  if (err instanceof ConfigNotFoundError) {
    logger.error(err.message);
    return;
  }
  if (err instanceof ConfigValidationError) {
    logger.error(`Invalid config${err.file ? ` (${err.file})` : ""}:`);
    for (const issue of err.zodError.issues) {
      const where = issue.path.length ? issue.path.join(".") : "(root)";
      logger.error(`  • ${where}: ${issue.message}`);
    }
    return;
  }
  logger.error(err instanceof Error ? err.message : String(err));
}

/** Print the per-asset result lines and a one-line tally. */
export function printSummary(
  logger: Logger,
  outcomes: AssetOutcome[],
  outDir: string,
): void {
  if (outcomes.length === 0) {
    logger.warn("No assets matched.");
    return;
  }
  logger.log("");
  for (const outcome of outcomes) {
    if (outcome.status === "ok") {
      for (const record of outcome.records) {
        logger.log(
          `  ${pc.green("✓")} ${pc.bold(outcome.name)}  ${pc.dim(record.file)}  ` +
            `${pc.dim(`${record.width}×${record.height}`)}  ${pc.dim(formatBytes(record.bytes))}`,
        );
      }
    } else {
      logger.log(
        `  ${pc.red("✗")} ${pc.bold(outcome.name)}  ${pc.red(outcome.error?.message ?? "failed")}`,
      );
    }
  }
  const ok = outcomes.filter((o) => o.status === "ok").length;
  const failed = outcomes.length - ok;
  logger.log("");
  logger.log(
    `${pc.green(`${ok} ok`)}${failed ? `, ${pc.red(`${failed} failed`)}` : ""}  →  ${outDir}`,
  );
}
