import { formatElapsed } from "@/pipeline/reporter";
import type { DashboardSnapshot, JobView } from "./store";

/** Braille spinner frames for running rows. */
export const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Width of the bar itself, in cells. */
export const BAR_WIDTH = 8;
/** Full width of the progress column: bar + space + a right-aligned "NN%". */
export const PROGRESS_COL = BAR_WIDTH + 4;
const BAR_FULL = "▓";
const BAR_EMPTY = "░";

/** Below these terminal widths, columns drop out so rows never wrap. */
const HIDE_DETAIL_BELOW = 76;
const HIDE_PROGRESS_BELOW = 60;

/** A chalk color name Ink understands, or undefined for the terminal default. */
export type Tone = string | undefined;

/** Text + how to paint it (Ink `<Text>` props). */
export interface Paint {
  text: string;
  color?: Tone;
  dim?: boolean;
}

/** A committed log line plus a stable React key. */
export interface LogVM extends Paint {
  key: number;
}

/** A fully-derived row, ready to lay out. */
export interface RowVM {
  id: string;
  glyph: Paint;
  name: string;
  detail: string;
  /** The progress column (fixed width PROGRESS_COL): bar, plus "NN%" when determinate. */
  progress: Paint;
  step: Paint;
  /** Elapsed, with a "~ETA" suffix once a determinate row is underway. */
  elapsed: string;
}

export interface TallyCell {
  text: string;
  color: Tone;
}

export interface DashboardVM {
  /** Total run elapsed (mm:ss), shown in the header. */
  elapsed: string;
  /** Header rollup across assets: done/total + cached. */
  overall: { done: number; total: number; cached: number };
  setup: RowVM[];
  assets: RowVM[];
  /** Running / waiting / failed cells for the ASSETS section header (done lives in the rollup). */
  tally: TallyCell[];
  footer: { text: string; tone: "dim" | "warn" };
  cancelling: boolean;
  /** Column widths so setup + asset rows align. */
  nameWidth: number;
  detailWidth: number;
  /** Adaptive flags: which columns fit the current terminal width. */
  showDetail: boolean;
  showProgress: boolean;
  logs: LogVM[];
}

const isDone = (v?: JobView): boolean =>
  Boolean(v && (v.status === "ok" || v.status === "cached"));

/** Collapse newlines/tabs so routed (multi-line) output renders as one row. */
const oneLine = (s: string): string => s.replace(/[\r\n\t]+/g, " ");

/** Live "why is this waiting" text: gates first (build/server), then asset deps, then queued. */
export function waitingReason(v: JobView, jobs: Map<string, JobView>): string {
  const label = (id: string): string => jobs.get(id)?.name ?? id;
  const gates = (v.gatedBy ?? []).filter((id) => !isDone(jobs.get(id)));
  if (gates.length) return `waiting for ${gates.map(label).join(", ")}`;
  const deps = (v.deps ?? []).filter((id) => !isDone(jobs.get(id)));
  if (deps.length) return `waiting on ${deps.map(label).join(", ")}`;
  return "queued";
}

export function glyph(v: JobView, frame: number, cancelling: boolean): Paint {
  switch (v.status) {
    case "running":
      return { text: SPINNER[frame % SPINNER.length] ?? "◐", color: cancelling ? "yellow" : "cyan" };
    case "ok":
      return { text: "✓", color: "green" };
    case "failed":
      return { text: "✗", color: "red" };
    case "cached":
      return { text: "⊙", color: "blue" };
    default:
      return { text: "·", dim: true };
  }
}

/**
 * The progress column (fixed width {@link PROGRESS_COL} so the step column stays aligned).
 * - done/cached/failed → a full bar (green/blue/red).
 * - running with a reported fraction → a determinate bar + "NN%".
 * - running with no fraction → an indeterminate cell that ping-pongs across the bar.
 * - waiting → an empty bar.
 */
export function progressColumn(v: JobView, frame: number, cancelling: boolean): Paint {
  const w = BAR_WIDTH;
  const pad = (s: string): string => s.padEnd(PROGRESS_COL);
  const live: Tone = cancelling ? "yellow" : "cyan";

  switch (v.status) {
    case "ok":
      return { text: pad(BAR_FULL.repeat(w)), color: "green" };
    case "cached":
      return { text: pad(BAR_FULL.repeat(w)), color: "blue" };
    case "failed":
      return { text: pad(BAR_FULL.repeat(w)), color: "red" };
    case "running": {
      if (typeof v.progress === "number") {
        const filled = Math.max(0, Math.min(w, Math.round(v.progress * w)));
        const bar = BAR_FULL.repeat(filled) + BAR_EMPTY.repeat(w - filled);
        const pct = `${Math.min(99, Math.floor(v.progress * 100))}%`.padStart(3);
        return { text: `${bar} ${pct}`, color: live };
      }
      const span = Math.max(1, w * 2 - 2); // ping-pong period over [0, w-1]
      const m = frame % span;
      const pos = m < w ? m : span - m;
      const cells = Array.from({ length: w }, (_, i) => (i === pos ? BAR_FULL : BAR_EMPTY)).join("");
      return { text: pad(cells), color: live };
    }
    default:
      return { text: pad(BAR_EMPTY.repeat(w)), dim: true };
  }
}

/** Elapsed for a row, plus a "~ETA" suffix once a determinate row is meaningfully underway. */
function rowElapsed(v: JobView, now: number): string {
  if (v.status === "waiting") return "";
  const dur = (v.endedAt ?? now) - (v.startedAt ?? now);
  const base = formatElapsed(dur);
  if (v.status === "running" && typeof v.progress === "number" && v.progress > 0.02 && v.progress < 1) {
    const eta = (dur * (1 - v.progress)) / v.progress;
    return `${base} ~${formatElapsed(eta)}`;
  }
  return base;
}

function rowOf(v: JobView, jobs: Map<string, JobView>, frame: number, now: number, cancelling: boolean): RowVM {
  const rawStep = v.status === "waiting" ? waitingReason(v, jobs) : v.step;
  const step: Paint =
    v.status === "failed"
      ? { text: oneLine(rawStep), color: "red" }
      : v.status === "running"
        ? { text: oneLine(rawStep) }
        : { text: oneLine(rawStep), dim: true };
  return {
    id: v.id,
    glyph: glyph(v, frame, cancelling),
    name: v.name,
    detail: v.detail,
    progress: progressColumn(v, frame, cancelling),
    step,
    elapsed: rowElapsed(v, now),
  };
}

const LOG_TONE: Record<string, Paint> = {
  error: { text: "", color: "red" },
  fail: { text: "", color: "red" },
  warn: { text: "", color: "yellow" },
  success: { text: "", color: "green" },
  debug: { text: "", dim: true },
};

/** Derive everything the `<Dashboard>` needs from a snapshot. Pure — unit-tested. */
export function buildView(
  snapshot: DashboardSnapshot,
  frame: number,
  now: number,
  columns?: number,
): DashboardVM {
  const jobs = new Map(snapshot.jobs.map((j) => [j.id, j]));
  const cancelling = snapshot.cancelRequested;

  const nameWidth = Math.min(22, Math.max(4, ...snapshot.jobs.map((j) => j.name.length)));
  const detailWidth = Math.min(14, Math.max(6, ...snapshot.jobs.map((j) => j.detail.length)));

  const setup: RowVM[] = [];
  const assets: RowVM[] = [];
  for (const j of snapshot.jobs) {
    (j.system ? setup : assets).push(rowOf(j, jobs, frame, now, cancelling));
  }

  // Counts cover assets only; setup rows (build/server) are shown but not counted.
  const assetJobs = snapshot.jobs.filter((j) => !j.system);
  const cached = assetJobs.filter((j) => j.status === "cached").length;
  const done = assetJobs.filter((j) => j.status === "ok" || j.status === "cached").length;
  const running = assetJobs.filter((j) => j.status === "running").length;
  const waiting = assetJobs.filter((j) => j.status === "waiting").length;
  const failed = assetJobs.filter((j) => j.status === "failed").length;

  const tally: TallyCell[] = [];
  if (running) tally.push({ text: `${running} running`, color: "cyan" });
  if (waiting) tally.push({ text: `${waiting} waiting`, color: undefined });
  if (failed) tally.push({ text: `${failed} failed`, color: "red" });

  const footer: DashboardVM["footer"] = cancelling
    ? { text: running ? `cancelling… finishing ${running} · esc to force` : "cancelling… · esc to force", tone: "warn" }
    : { text: "esc to cancel", tone: "dim" };

  const logs: LogVM[] = snapshot.logs.map((l) => ({
    ...(LOG_TONE[l.type] ?? {}),
    key: l.key,
    text: oneLine(l.message),
  }));

  return {
    elapsed: formatElapsed(now - snapshot.startTime),
    overall: { done, total: assetJobs.length, cached },
    setup,
    assets,
    tally,
    footer,
    cancelling,
    nameWidth,
    detailWidth,
    showDetail: columns === undefined || columns >= HIDE_DETAIL_BELOW,
    showProgress: columns === undefined || columns >= HIDE_PROGRESS_BELOW,
    logs,
  };
}
