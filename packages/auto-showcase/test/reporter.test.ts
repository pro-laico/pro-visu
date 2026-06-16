import { describe, expect, it } from "vitest";
import { formatElapsed, truncate } from "@/pipeline/reporter";
import { DashboardStore, type JobView } from "@/cli/dashboard/store";
import {
  PROGRESS_COL,
  SPINNER,
  buildView,
  glyph,
  progressColumn,
  waitingReason,
} from "@/cli/dashboard/view-model";
import { InkReporter, NoopReporter, createReporter } from "@/cli/dashboard";

describe("formatElapsed", () => {
  it("formats mm:ss and floors to whole seconds", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(4000)).toBe("0:04");
    expect(formatElapsed(65_000)).toBe("1:05");
    expect(formatElapsed(-500)).toBe("0:00");
  });
});

describe("truncate", () => {
  it("leaves short strings and ellipsizes long ones", () => {
    expect(truncate("hi", 10)).toBe("hi");
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
    expect(truncate("anything", 0)).toBe("");
  });
});

describe("DashboardStore", () => {
  it("adds rows as waiting and reflects status transitions", () => {
    const s = new DashboardStore(0);
    s.add({ id: "home-reel", name: "home-reel", detail: "scroll-reel" });
    let job = s.getSnapshot().jobs[0]!;
    expect(job.status).toBe("waiting");
    expect(job.step).toBe("");

    s.status("home-reel", "running", 1000);
    job = s.getSnapshot().jobs[0]!;
    expect(job.status).toBe("running");
    expect(job.startedAt).toBe(1000);
    expect(job.step).toBe("starting…"); // waiting → running fills an interim step

    s.step("home-reel", "recording…");
    s.status("home-reel", "ok", 4000);
    job = s.getSnapshot().jobs[0]!;
    expect(job.status).toBe("ok");
    expect(job.endedAt).toBe(4000);
    expect(job.step).toBe("recording…"); // a real step is kept, not overwritten with "done"
  });

  it("labels cached and bare-ok rows", () => {
    const s = new DashboardStore(0);
    s.add({ id: "a", name: "a", detail: "scene" });
    s.add({ id: "b", name: "b", detail: "scene" });
    s.status("a", "cached", 10);
    s.status("b", "running", 0);
    s.status("b", "ok", 10); // no step set → "done"
    const [a, b] = s.getSnapshot().jobs as [JobView, JobView];
    expect(a.step).toBe("cached");
    expect(b.step).toBe("done");
  });

  it("ignores unknown ids and de-dupes adds", () => {
    const s = new DashboardStore(0);
    s.add({ id: "a", name: "a", detail: "scene" });
    s.add({ id: "a", name: "again", detail: "scene" }); // ignored
    s.status("ghost", "ok"); // ignored, no throw
    expect(s.getSnapshot().jobs).toHaveLength(1);
    expect(s.getSnapshot().jobs[0]!.name).toBe("a");
    expect(s.has("a")).toBe(true);
    expect(s.has("ghost")).toBe(false);
  });

  it("commits logs with stable, monotonic keys", () => {
    const s = new DashboardStore(0);
    s.log("info", "first");
    s.log("error", "second");
    const { logs } = s.getSnapshot();
    expect(logs.map((l) => l.message)).toEqual(["first", "second"]);
    expect(logs[1]!.key).toBeGreaterThan(logs[0]!.key);
  });

  it("records clamped progress on a running row", () => {
    const s = new DashboardStore(0);
    s.add({ id: "a", name: "a", detail: "scene" });
    s.progress("a", 0.5);
    expect(s.getSnapshot().jobs[0]!.progress).toBe(0.5);
    s.progress("a", 1.7); // clamped to [0,1]
    expect(s.getSnapshot().jobs[0]!.progress).toBe(1);
    s.progress("ghost", 0.5); // unknown id ignored, no throw
  });

  it("keeps snapshot identity stable between mutations and notifies subscribers", () => {
    const s = new DashboardStore(0);
    const first = s.getSnapshot();
    expect(s.getSnapshot()).toBe(first); // stable with no change

    let notifications = 0;
    const unsubscribe = s.subscribe(() => (notifications += 1));
    s.add({ id: "a", name: "a", detail: "scene" });
    const second = s.getSnapshot();
    expect(second).not.toBe(first); // new reference after a change
    expect(s.getSnapshot()).toBe(second); // stable again until the next change
    expect(notifications).toBe(1);

    unsubscribe();
    s.cancelling();
    expect(notifications).toBe(1); // no longer subscribed
  });
});

describe("waitingReason", () => {
  const map = (jobs: JobView[]): Map<string, JobView> => new Map(jobs.map((j) => [j.id, j]));

  it("names pending gates, then pending deps, then queued", () => {
    const build: JobView = { id: "@build", name: "build", detail: "server", status: "running", step: "" };
    const dep: JobView = { id: "home", name: "home", detail: "scroll-reel", status: "ok", step: "" };
    const gated: JobView = {
      id: "frame",
      name: "frame",
      detail: "scene",
      status: "waiting",
      step: "",
      gatedBy: ["@build"],
      deps: ["home"],
    };
    expect(waitingReason(gated, map([build, dep, gated]))).toBe("waiting for build");

    build.status = "ok"; // gate satisfied → fall through to deps (already done) → queued
    expect(waitingReason(gated, map([build, dep, gated]))).toBe("queued");

    dep.status = "running"; // a pending dep
    expect(waitingReason(gated, map([build, dep, gated]))).toBe("waiting on home");
  });
});

describe("glyph + progressColumn", () => {
  const running: JobView = { id: "a", name: "a", detail: "scene", status: "running", step: "" };

  it("animates the spinner and tints amber while cancelling", () => {
    expect(glyph(running, 0, false)).toEqual({ text: SPINNER[0], color: "cyan" });
    expect(glyph(running, 1, false).text).toBe(SPINNER[1]);
    expect(glyph(running, 0, true).color).toBe("yellow");
    expect(glyph({ ...running, status: "ok" }, 0, false)).toEqual({ text: "✓", color: "green" });
    expect(glyph({ ...running, status: "waiting" }, 0, false)).toEqual({ text: "·", dim: true });
  });

  it("keeps the progress column a fixed width for every state", () => {
    for (const status of ["waiting", "running", "ok", "failed", "cached"] as const) {
      expect(progressColumn({ ...running, status }, 3, false).text).toHaveLength(PROGRESS_COL);
    }
  });

  it("shows an indeterminate sweep when no fraction is reported", () => {
    const col = progressColumn(running, 1, false);
    expect(col.text).toContain("▓"); // one lit cell sweeping
    expect(col.text).not.toMatch(/%/); // no percentage without a fraction
  });

  it("draws a determinate bar with a percentage when progress is known", () => {
    const col = progressColumn({ ...running, progress: 0.5 }, 0, false);
    expect(col.text).toContain("50%");
    expect(col.text).toHaveLength(PROGRESS_COL);
    expect(col.color).toBe("cyan");
  });
});

describe("buildView", () => {
  function fixture(): DashboardStore {
    const s = new DashboardStore(0);
    s.add({ id: "@build", name: "build", detail: "server", system: true });
    s.add({ id: "@server", name: "server", detail: "server", system: true, gatedBy: ["@build"] });
    s.add({ id: "home", name: "home-reel", detail: "scroll-reel", gatedBy: ["@build", "@server"] });
    s.add({ id: "shop", name: "shop-reel", detail: "scroll-reel", gatedBy: ["@build", "@server"] });
    return s;
  }

  it("splits setup from assets and rolls up an asset-only count", () => {
    const s = fixture();
    s.status("home", "running", 0);
    const vm = buildView(s.getSnapshot(), 0, 5000);
    expect(vm.setup.map((r) => r.name)).toEqual(["build", "server"]);
    expect(vm.assets.map((r) => r.name)).toEqual(["home-reel", "shop-reel"]);
    // Header rollup counts assets only; setup rows (build/server) are excluded.
    expect(vm.overall).toEqual({ done: 0, total: 2, cached: 0 });
    // The section tally carries the live breakdown (done lives in the header rollup).
    expect(vm.tally.map((c) => c.text)).toEqual(["1 running", "1 waiting"]);
    expect(vm.elapsed).toBe("0:05"); // now - startTime
  });

  it("counts cached assets in the rollup", () => {
    const s = fixture();
    s.status("home", "cached", 0);
    s.status("shop", "ok", 0);
    expect(buildView(s.getSnapshot(), 0, 0).overall).toEqual({ done: 2, total: 2, cached: 1 });
  });

  it("surfaces the gated waiting reason and elapsed in rows", () => {
    const s = fixture();
    const vm = buildView(s.getSnapshot(), 0, 0);
    const home = vm.assets.find((r) => r.name === "home-reel")!;
    expect(home.step.text).toBe("waiting for build, server");
    expect(home.elapsed).toBe(""); // waiting rows show no timer
  });

  it("appends a ~ETA once a determinate row is underway", () => {
    const s = fixture();
    s.status("home", "running", 0);
    s.progress("home", 0.25); // 25% in 10s ⇒ ~30s remaining
    const home = buildView(s.getSnapshot(), 0, 10_000).assets.find((r) => r.name === "home-reel")!;
    expect(home.elapsed).toBe("0:10 ~0:30");
  });

  it("reports a failed count and paints failed steps red", () => {
    const s = fixture();
    s.status("home", "running", 0);
    s.step("home", "boom");
    s.status("home", "failed", 1000);
    const vm = buildView(s.getSnapshot(), 0, 0);
    expect(vm.tally.some((c) => c.text === "1 failed" && c.color === "red")).toBe(true);
    expect(vm.assets.find((r) => r.name === "home-reel")!.step).toMatchObject({
      text: "boom",
      color: "red",
    });
  });

  it("shows every asset row when they fit the terminal height", () => {
    const s = new DashboardStore(0);
    for (let i = 0; i < 4; i++) s.add({ id: `a${i}`, name: `a${i}`, detail: "scene" });
    const vm = buildView(s.getSnapshot(), 0, 0, 100, 40);
    expect(vm.assets).toHaveLength(4);
    expect(vm.assetsBefore).toBe(0);
    expect(vm.assetsAfter).toBe(0);
  });

  it("windows the asset rows to fit the height, anchored on the running row", () => {
    const s = new DashboardStore(0);
    for (let i = 0; i < 20; i++) s.add({ id: `a${i}`, name: `a${i}`, detail: "scene" });
    s.status("a10", "running", 0); // anchor mid-list
    const rowsBudget = 16;
    const vm = buildView(s.getSnapshot(), 0, 0, 100, rowsBudget);

    const markerLines = (vm.assetsBefore > 0 ? 1 : 0) + (vm.assetsAfter > 0 ? 1 : 0);
    const chrome = 7 + 1; // no setup + 1 safety
    // The whole live block (chrome + markers + visible rows) must fit the terminal — that's the fix.
    expect(vm.assets.length + markerLines + chrome).toBeLessThanOrEqual(rowsBudget);
    // Nothing is lost: hidden-above + visible + hidden-below covers all 20.
    expect(vm.assetsBefore + vm.assets.length + vm.assetsAfter).toBe(20);
    expect(vm.assetsBefore).toBeGreaterThan(0);
    expect(vm.assetsAfter).toBeGreaterThan(0);
    expect(vm.assets.some((r) => r.id === "a10")).toBe(true); // the active row stays in view
    // The tally still counts ALL assets (not just the visible window).
    expect(vm.tally).toEqual([
      { text: "1 running", color: "cyan" },
      { text: "19 waiting", color: undefined },
    ]);
  });

  it("scrolls the asset window to a manual start, clamped to maxStart", () => {
    const s = new DashboardStore(0);
    for (let i = 0; i < 20; i++) s.add({ id: `a${i}`, name: `a${i}`, detail: "scene" });
    s.status("a10", "running", 0);
    const rowsBudget = 16; // budget 8 → show 6 → maxStart = 20 - 6 = 14

    expect(buildView(s.getSnapshot(), 0, 0, 100, rowsBudget).maxStart).toBe(14);

    // Manual start at the top overrides the running-anchored window.
    const top = buildView(s.getSnapshot(), 0, 0, 100, rowsBudget, 0);
    expect(top.assetsBefore).toBe(0);
    expect(top.assets[0]!.id).toBe("a0");

    // Over-scroll is clamped to maxStart (window pinned to the end, nothing hidden below).
    const bottom = buildView(s.getSnapshot(), 0, 0, 100, rowsBudget, 999);
    expect(bottom.assetsBefore).toBe(14);
    expect(bottom.assetsAfter).toBe(0);
    expect(bottom.assets.at(-1)!.id).toBe("a19");
  });

  it("drops columns on narrow terminals", () => {
    const s = fixture();
    const wide = buildView(s.getSnapshot(), 0, 0, 120);
    expect(wide.showDetail).toBe(true);
    expect(wide.showProgress).toBe(true);
    const mid = buildView(s.getSnapshot(), 0, 0, 70);
    expect(mid.showDetail).toBe(false);
    expect(mid.showProgress).toBe(true);
    const narrow = buildView(s.getSnapshot(), 0, 0, 50);
    expect(narrow.showProgress).toBe(false);
  });

  it("swaps the footer for a cancelling banner that names in-flight work", () => {
    const s = fixture();
    s.status("home", "running", 0);
    expect(buildView(s.getSnapshot(), 0, 0).footer).toEqual({ text: "esc to cancel", tone: "dim" });

    s.cancelling();
    expect(buildView(s.getSnapshot(), 0, 0).footer).toEqual({
      text: "cancelling… finishing 1 · esc to force",
      tone: "warn",
    });
  });

  it("collapses multi-line routed output into a single-line step", () => {
    const s = fixture();
    s.status("home", "running", 0);
    s.step("home", "ok\nprerendered\tstatic");
    const home = buildView(s.getSnapshot(), 0, 0).assets.find((r) => r.name === "home-reel")!;
    expect(home.step.text).toBe("ok prerendered static");
  });
});

describe("createReporter", () => {
  it("is no-op without a TTY and the live dashboard with one", () => {
    delete process.env.SHOWCASE_LIVE;
    expect(createReporter({ tty: false, verbose: false })).toBeInstanceOf(NoopReporter);
    expect(createReporter({ tty: true, verbose: false })).toBeInstanceOf(InkReporter);
    expect(createReporter({ tty: true, verbose: true })).toBeInstanceOf(NoopReporter);
  });

  it("respects the SHOWCASE_LIVE override", () => {
    try {
      process.env.SHOWCASE_LIVE = "1";
      expect(createReporter({ tty: false, verbose: true })).toBeInstanceOf(InkReporter);
      process.env.SHOWCASE_LIVE = "0";
      expect(createReporter({ tty: true, verbose: false })).toBeInstanceOf(NoopReporter);
    } finally {
      delete process.env.SHOWCASE_LIVE;
    }
  });
});
