import type { ZodError } from "zod";

import type { Logger } from "@/utils/logger";
import type { AssetOutcome } from "@/pipeline/runner";
import { renderSummary } from "@/cli/dashboard/Summary";
import { ConfigNotFoundError, ConfigValidationError } from "@/config/load";

/** Render a ZodError's issues as pointed `path: message` bullets (shared by config + option errors). */
function zodIssueLines(zodError: ZodError, pathPrefix = ""): string[] {
  return zodError.issues.map((issue) => {
    const joined = issue.path.join(".");
    const where = [pathPrefix, joined].filter(Boolean).join(".") || "(root)";
    return `  • ${where}: ${issue.message}`;
  });
}

/** Print a friendly, actionable message for config load/validation errors. */
export function reportConfigError(logger: Logger, err: unknown): void {
  if (err instanceof ConfigNotFoundError) {
    logger.error(err.message);
    return;
  }
  if (err instanceof ConfigValidationError) {
    logger.error(`Invalid config${err.file ? ` (${err.file})` : ""}:`);
    for (const line of zodIssueLines(err.zodError)) logger.error(line);
    return;
  }
  logger.error(err instanceof Error ? err.message : String(err));
}

/** Print the final results panel (a rendered Ink summary) and a one-line note when nothing matched. */
export function printSummary(logger: Logger, outcomes: AssetOutcome[], outDir: string): void {
  if (outcomes.length === 0) {
    logger.warn("No assets matched.");
    return;
  }
  logger.log("");
  logger.log(renderSummary(outcomes, outDir, process.stdout.columns ?? 80));
}
