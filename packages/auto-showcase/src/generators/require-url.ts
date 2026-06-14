import type { PipelineContext } from "@/generators/types";

/** Narrow a url-based generator's target url, with a clear error when it's missing. */
export function requireUrl(ctx: PipelineContext): string {
  if (!ctx.target.url) {
    throw new Error(`Asset "${ctx.target.name}" requires a "url" in its config.`);
  }
  return ctx.target.url;
}
