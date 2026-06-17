import type { JobStatus, RowInit } from "@/pipeline/reporter";

/** A row's live state: its init data plus where it is in the run and its current step text. */
export interface JobView extends RowInit {
  status: JobStatus;
  step: string;
  startedAt?: number;
  endedAt?: number;
  /** Fractional progress (0–1) while running, if the generator reports it; else undefined. */
  progress?: number;
}

/** A log line committed above the dashboard (untagged logs and logs for unknown tags). */
export interface LogLine {
  /** Monotonic id so React keys stay stable as the list grows. */
  key: number;
  /** consola log type (info/warn/error/success/…) — drives the line's color. */
  type: string;
  message: string;
}

/** An immutable view of the whole run, handed to React via useSyncExternalStore. */
export interface DashboardSnapshot {
  jobs: JobView[];
  logs: LogLine[];
  startTime: number;
  cancelRequested: boolean;
  /** Optional banner verb shown while cancelling (e.g. "low memory — stopping…"). */
  cancelReason?: string;
}

/**
 * The mutable run state behind the live dashboard, deliberately decoupled from React: the Ink
 * `<Dashboard>` subscribes to it with `useSyncExternalStore`, and {@link InkReporter} drives it
 * through the {@link Reporter} API. Each mutation rebuilds an immutable {@link DashboardSnapshot};
 * `getSnapshot` returns the same reference until the next change, so React's referential check
 * stays stable across spinner re-renders (which read state but never mutate it).
 */
export class DashboardStore {
  private jobs = new Map<string, JobView>();
  private order: string[] = [];
  private logs: LogLine[] = [];
  private logSeq = 0;
  private cancelRequested = false;
  private cancelReason?: string;
  private readonly startTime: number;
  private snap: DashboardSnapshot;
  private readonly listeners = new Set<() => void>();

  constructor(now: number = Date.now()) {
    this.startTime = now;
    this.snap = this.build();
  }

  /** Subscribe to changes (useSyncExternalStore). Returns an unsubscribe. */
  readonly subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  };

  /** The current immutable snapshot (stable between mutations). */
  readonly getSnapshot = (): DashboardSnapshot => this.snap;

  has(id: string): boolean {
    return this.jobs.has(id);
  }

  private build(): DashboardSnapshot {
    return {
      jobs: this.order
        .map((id) => this.jobs.get(id))
        .filter((v): v is JobView => Boolean(v)),
      logs: this.logs,
      startTime: this.startTime,
      cancelRequested: this.cancelRequested,
      cancelReason: this.cancelReason,
    };
  }

  private commit(): void {
    this.snap = this.build();
    for (const cb of this.listeners) cb();
  }

  add(row: RowInit): void {
    if (this.jobs.has(row.id)) return;
    // The waiting reason is derived at render time from gate/dep state, so it stays accurate.
    this.jobs.set(row.id, { ...row, deps: row.deps ?? [], status: "waiting", step: "" });
    this.order.push(row.id);
    this.commit();
  }

  status(id: string, status: JobStatus, now: number = Date.now()): void {
    const j = this.jobs.get(id);
    if (!j) return;
    if (status === "running" && j.status !== "running") {
      j.startedAt = now;
      if (!j.step || j.step === "queued" || j.step.startsWith("waiting")) j.step = "starting…";
    }
    if (status === "ok" || status === "failed" || status === "cached") {
      j.endedAt = now;
      if (status === "cached") j.step = "cached";
      else if (status === "ok" && (j.step === "" || j.step === "starting…" || j.step === "queued"))
        j.step = "done";
    }
    j.status = status;
    this.commit();
  }

  step(id: string, text: string): void {
    const j = this.jobs.get(id);
    if (!j) return;
    j.step = text;
    this.commit();
  }

  progress(id: string, value: number): void {
    const j = this.jobs.get(id);
    if (!j) return;
    j.progress = Math.max(0, Math.min(1, value));
    this.commit();
  }

  /** Commit a log line above the dashboard. */
  log(type: string, message: string): void {
    this.logs = [...this.logs, { key: this.logSeq++, type, message }];
    this.commit();
  }

  /** Flip into the "cancelling…" state (idempotent). An optional reason customizes the banner verb. */
  cancelling(reason?: string): void {
    if (this.cancelRequested) return;
    this.cancelRequested = true;
    this.cancelReason = reason;
    this.commit();
  }
}
