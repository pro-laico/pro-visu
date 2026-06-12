import type { LogSink } from "@/utils/logger";

export type JobStatus = "waiting" | "running" | "ok" | "failed" | "cached";

export interface RowInit {
  /** Stable id; for assets this is the asset name (so tagged logs route to it). */
  id: string;
  /** Primary label. */
  name: string;
  /** Dim secondary column — the generator id, or "server" for setup rows. */
  detail: string;
  /** Ids this row waits on (assets it depends on). */
  deps?: string[];
  /** Setup row ids (build/server) that must finish before this row can start. */
  gatedBy?: string[];
  /** Setup rows (build/server) — shown, but excluded from the asset tally. */
  system?: boolean;
}

/**
 * A progress sink driven across a whole run: setup steps (build/server) and then each asset as
 * it moves through the DAG. Implemented by the live terminal tracker (and a no-op for
 * non-TTY/CI). Also a {@link LogSink} so tagged generator logs become a row's current step.
 * The caller owns begin()/stop(); rows are added incrementally with add().
 */
export interface Reporter extends LogSink {
  /** True for the live renderer; false for the no-op. */
  readonly isLive: boolean;
  begin(): void;
  add(row: RowInit): void;
  status(id: string, status: JobStatus): void;
  step(id: string, text: string): void;
  stop(): void;
}

/** mm:ss for a millisecond duration (pure — unit-tested). */
export function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** Truncate to a visible width with an ellipsis (pure — unit-tested). */
export function truncate(text: string, width: number): string {
  if (width <= 0) return "";
  if (text.length <= width) return text;
  return `${text.slice(0, Math.max(0, width - 1))}…`;
}
