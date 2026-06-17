import { render, type Instance } from "ink";
import type { JobStatus, Reporter, RowInit } from "@/pipeline/reporter";
import { DashboardStore } from "./store";
import { Dashboard } from "./Dashboard";

/** No-op reporter for non-TTY / CI / --verbose: logs print normally, nothing is rendered. */
export class NoopReporter implements Reporter {
  readonly isLive = false;
  begin(): void {}
  add(): void {}
  status(): void {}
  step(): void {}
  progress(): void {}
  cancelling(): void {}
  stop(): void {}
  route(): boolean {
    return false;
  }
}

/**
 * Live terminal dashboard backed by Ink (React). The {@link DashboardStore} holds run state; this
 * class drives it through the {@link Reporter} API and owns the Ink render lifecycle. Tagged
 * generator logs become a row's current step; everything else is committed above the dashboard.
 */
export class InkReporter implements Reporter {
  readonly isLive = true;
  private readonly store = new DashboardStore();
  private instance?: Instance;
  private stopped = false;
  private onInterrupt?: () => void;

  constructor(private readonly out: NodeJS.WriteStream = process.stdout) {}

  /** Let the dashboard own Esc/Ctrl+C; calls this trigger on each press. Call before begin(). */
  attachInput(onInterrupt: () => void): void {
    this.onInterrupt = onInterrupt;
  }

  begin(): void {
    if (this.instance || this.stopped) return;
    this.instance = render(<Dashboard store={this.store} onInterrupt={() => this.onInterrupt?.()} />, {
      stdout: this.out,
      // We route logs through the dashboard ourselves, so Ink shouldn't also patch console.
      patchConsole: false,
      // Esc/Ctrl+C is handled inside the dashboard via useInput; Ink must not exit on its own.
      exitOnCtrlC: false,
    });
  }

  add(row: RowInit): void {
    this.store.add(row);
  }

  status(id: string, status: JobStatus): void {
    this.store.status(id, status);
  }

  step(id: string, text: string): void {
    this.store.step(id, text);
  }

  progress(id: string, value: number): void {
    this.store.progress(id, value);
  }

  cancelling(reason?: string): void {
    this.store.cancelling(reason);
  }

  route(tag: string, type: string, message: string): boolean {
    if (this.stopped) return false; // after teardown, let logs print normally
    if (tag && this.store.has(tag)) {
      this.store.step(tag, message);
      return true;
    }
    this.store.log(type, message);
    return true;
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    // Erase the live box before the final summary prints (committed Static logs stay in scrollback).
    // clear() + unmount() run synchronously so the animation timer can't redraw between them.
    this.instance?.clear();
    this.instance?.unmount();
  }
}

/**
 * Pick the live dashboard on an interactive TTY (unless --verbose, which wants full logs).
 * `SHOWCASE_LIVE=1` forces it on (e.g. terminals that mis-report TTY); `=0` forces it off.
 */
export function createReporter(opts: { tty: boolean; verbose: boolean }): Reporter {
  const forced = process.env.SHOWCASE_LIVE;
  if (forced === "0") return new NoopReporter();
  if (forced === "1") return new InkReporter();
  return opts.tty && !opts.verbose ? new InkReporter() : new NoopReporter();
}
