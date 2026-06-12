import pc from "picocolors";
import {
  formatElapsed,
  truncate,
  type JobStatus,
  type Reporter,
  type RowInit,
} from "@/pipeline/reporter";

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface JobView extends RowInit {
  status: JobStatus;
  step: string;
  startedAt?: number;
  endedAt?: number;
}

/** No-op reporter for non-TTY / CI / --verbose: logs print normally, nothing is rendered. */
export class NoopReporter implements Reporter {
  readonly isLive = false;
  begin(): void {}
  add(): void {}
  status(): void {}
  step(): void {}
  stop(): void {}
  route(): boolean {
    return false;
  }
}

/** Live in-place terminal tracker: one row per task with status, current step, and elapsed. */
export class LiveReporter implements Reporter {
  readonly isLive = true;
  private jobs = new Map<string, JobView>();
  private order: string[] = [];
  private frame = 0;
  private prevLines = 0;
  private startTime = 0;
  private started = false;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly out: NodeJS.WriteStream = process.stdout) {}

  begin(): void {
    if (this.started) return;
    this.started = true;
    this.startTime = Date.now();
    this.out.write("\x1b[?25l"); // hide cursor
    this.render();
    this.timer = setInterval(() => {
      this.frame += 1;
      this.render();
    }, 90);
    this.timer.unref?.();
  }

  add(row: RowInit): void {
    if (this.jobs.has(row.id)) return;
    // The waiting reason is computed at render time from gate/dep state, so it stays accurate.
    this.jobs.set(row.id, { ...row, deps: row.deps ?? [], status: "waiting", step: "" });
    this.order.push(row.id);
    this.render();
  }

  private isDone(id: string): boolean {
    const j = this.jobs.get(id);
    return Boolean(j && (j.status === "ok" || j.status === "cached"));
  }

  private label(id: string): string {
    return this.jobs.get(id)?.name ?? id;
  }

  /** Live "why is this waiting" text: gates first (build/server), then asset deps, then queued. */
  private waitingReason(v: JobView): string {
    const gatesPending = (v.gatedBy ?? []).filter((id) => !this.isDone(id));
    if (gatesPending.length) return `waiting for ${gatesPending.map((id) => this.label(id)).join(", ")}`;
    const depsPending = (v.deps ?? []).filter((id) => !this.isDone(id));
    if (depsPending.length) return `waiting on ${depsPending.map((id) => this.label(id)).join(", ")}`;
    return "queued";
  }

  status(id: string, status: JobStatus): void {
    const j = this.jobs.get(id);
    if (!j) return;
    if (status === "running" && j.status !== "running") {
      j.startedAt = Date.now();
      if (!j.step || j.step === "queued" || j.step.startsWith("waiting")) j.step = "starting…";
    }
    if (status === "ok" || status === "failed" || status === "cached") {
      j.endedAt = Date.now();
      if (status === "cached") j.step = "cached";
      else if (status === "ok" && (j.step === "" || j.step === "starting…" || j.step === "queued"))
        j.step = "done";
    }
    j.status = status;
    this.render();
  }

  step(id: string, text: string): void {
    const j = this.jobs.get(id);
    if (j) j.step = text;
  }

  route(tag: string, _type: string, message: string): boolean {
    if (!this.jobs.has(tag)) return false;
    this.step(tag, message);
    return true;
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.timer) clearInterval(this.timer);
    this.erase();
    this.out.write("\x1b[?25h"); // restore cursor
  }

  private glyph(v: JobView): string {
    switch (v.status) {
      case "running":
        return pc.cyan(SPINNER[this.frame % SPINNER.length] ?? "◐");
      case "ok":
        return pc.green("✓");
      case "failed":
        return pc.red("✗");
      case "cached":
        return pc.blue("⊙");
      default:
        return pc.dim("·");
    }
  }

  private elapsed(v: JobView): string {
    if (v.status === "waiting") return "";
    const end = v.endedAt ?? Date.now();
    return formatElapsed(end - (v.startedAt ?? end));
  }

  private compose(): string[] {
    const cols = this.out.columns ?? 80;
    const views = this.order.map((n) => this.jobs.get(n)).filter((v): v is JobView => Boolean(v));
    const nameW = Math.min(22, Math.max(4, ...views.map((v) => v.name.length)));
    const genW = Math.min(14, Math.max(6, ...views.map((v) => v.detail.length)));

    const lines = views.map((v) => {
      const elapsed = this.elapsed(v);
      const prefix = 2 + 1 + 1 + nameW + 2 + genW + 2; // indent+glyph+sp+name+sp+gen+sp
      const budget = Math.max(8, cols - prefix - (elapsed ? elapsed.length + 1 : 0));
      const text = v.status === "waiting" ? this.waitingReason(v) : v.step;
      const rawStep = truncate(text, budget);
      const step =
        v.status === "failed"
          ? pc.red(rawStep)
          : v.status === "running"
            ? rawStep
            : pc.dim(rawStep);
      return (
        `  ${this.glyph(v)} ${pc.bold(v.name.padEnd(nameW))}  ${pc.dim(v.detail.padEnd(genW))}  ` +
        `${step}${elapsed ? ` ${pc.dim(elapsed)}` : ""}`
      );
    });

    // The tally is over assets only; setup rows (build/server) are shown but not counted.
    const jobs = views.filter((v) => !v.system);
    const ok = jobs.filter((v) => v.status === "ok" || v.status === "cached").length;
    const failed = jobs.filter((v) => v.status === "failed").length;
    const running = jobs.filter((v) => v.status === "running").length;
    const waiting = jobs.filter((v) => v.status === "waiting").length;
    const parts = [pc.green(`${ok}/${jobs.length} done`)];
    if (running) parts.push(pc.cyan(`${running} running`));
    if (waiting) parts.push(pc.dim(`${waiting} waiting`));
    if (failed) parts.push(pc.red(`${failed} failed`));
    parts.push(pc.dim(formatElapsed(Date.now() - this.startTime)));

    lines.push(pc.dim(`  ${"─".repeat(Math.min(40, cols - 2))}`));
    lines.push(`  ${parts.join(pc.dim(" · "))}`);
    return lines;
  }

  private render(): void {
    const lines = this.compose();
    let out = "";
    if (this.prevLines > 0) out += `\x1b[${this.prevLines}A`;
    out += "\x1b[0J"; // clear from cursor to end of screen
    out += lines.join("\n");
    if (lines.length) out += "\n";
    this.out.write(out);
    this.prevLines = lines.length;
  }

  private erase(): void {
    if (this.prevLines > 0) this.out.write(`\x1b[${this.prevLines}A\x1b[0J`);
    this.prevLines = 0;
  }
}

/**
 * Pick the live tracker on an interactive TTY (unless --verbose, which wants full logs).
 * `SHOWCASE_LIVE=1` forces it on (e.g. terminals that mis-report TTY); `=0` forces it off.
 */
export function createReporter(opts: { tty: boolean; verbose: boolean }): Reporter {
  const forced = process.env.SHOWCASE_LIVE;
  if (forced === "0") return new NoopReporter();
  if (forced === "1") return new LiveReporter();
  return opts.tty && !opts.verbose ? new LiveReporter() : new NoopReporter();
}
