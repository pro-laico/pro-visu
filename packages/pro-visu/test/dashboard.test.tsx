import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Dashboard } from "@/cli/dashboard/Dashboard";
import { DashboardStore } from "@/cli/dashboard/store";
import { InkReporter } from "@/cli/dashboard";
import { renderSummary } from "@/cli/dashboard/Summary";
import type { AssetOutcome } from "@/pipeline/runner";
import type { AssetRecord } from "@/manifest/schema";

/** A minimal AssetRecord for summary tests. */
function rec(over: Partial<AssetRecord>): AssetRecord {
  return {
    id: "x",
    generator: "scroll-reel",
    sourceUrl: "http://localhost",
    file: "pro-visu/x.mp4",
    format: "mp4",
    width: 1080,
    height: 1920,
    bytes: 2_400_000,
    contentHash: "h",
    createdAt: "2026-01-01T00:00:00Z",
    toolVersion: "0",
    ...over,
  };
}

/** Strip ANSI so assertions match the visible text. */
const plain = (s: string | undefined): string => (s ?? "").replace(/\x1b\[[0-9;]*m/g, "");

/** A minimal non-TTY write stream Ink can render into. */
function fakeStdout(): { stream: NodeJS.WriteStream; text: () => string } {
  const writes: string[] = [];
  const stream = {
    columns: 90,
    rows: 30,
    isTTY: false,
    write: (s: string) => {
      writes.push(s);
      return true;
    },
    on: () => stream,
    off: () => stream,
    removeListener: () => stream,
  };
  return { stream: stream as unknown as NodeJS.WriteStream, text: () => writes.join("") };
}

describe("<Dashboard>", () => {
  it("renders the header, sections, gated waiting reason, and cancel footer", () => {
    const store = new DashboardStore(0);
    store.add({ id: "@build", name: "build", detail: "server", system: true });
    store.add({ id: "home-reel", name: "home-reel", detail: "scroll-reel", gatedBy: ["@build"] });

    const { lastFrame, unmount } = render(<Dashboard store={store} />);
    const frame = plain(lastFrame());
    expect(frame).toContain("pro-visu"); // header title
    expect(frame).toContain("SETUP");
    expect(frame).toContain("ASSETS");
    expect(frame).toContain("home-reel");
    expect(frame).toContain("waiting for build");
    expect(frame).toContain("esc to cancel");
    unmount();
  });

  it("flips to the cancelling banner once requested", () => {
    const store = new DashboardStore(0);
    store.add({ id: "a", name: "a", detail: "scene" });
    store.status("a", "running", 0);
    store.cancelling();

    const { lastFrame, unmount } = render(<Dashboard store={store} />);
    const frame = plain(lastFrame());
    expect(frame).toContain("cancelling…");
    expect(frame).toContain("finishing 1");
    expect(frame).not.toContain("esc to cancel");
    unmount();
  });
});

describe("InkReporter", () => {
  it("mounts, drives the run, and tears down without throwing", () => {
    const { stream } = fakeStdout();
    const r = new InkReporter(stream);
    let interrupts = 0;
    expect(() => {
      r.attachInput(() => (interrupts += 1)); // wired before begin
      r.begin();
      r.begin(); // idempotent
      r.add({ id: "@build", name: "build", detail: "server", system: true });
      r.add({ id: "home-reel", name: "home-reel", detail: "scroll-reel", gatedBy: ["@build"] });
      r.status("@build", "ok");
      r.status("home-reel", "running");
      r.step("home-reel", "recording…");
      r.progress("home-reel", 0.4);
      r.cancelling();
      r.stop();
      r.stop(); // idempotent
    }).not.toThrow();
    expect(interrupts).toBe(0); // no input simulated; just verifying the wiring doesn't fire
  });

  it("routes tagged logs to a row, absorbs the rest, and passes through after teardown", () => {
    const { stream } = fakeStdout();
    const r = new InkReporter(stream);
    r.begin();
    r.add({ id: "home-reel", name: "home-reel", detail: "scroll-reel" });

    expect(r.route("home-reel", "info", "recording…")).toBe(true); // tagged → row step
    expect(r.route("", "info", "untagged note")).toBe(true); // absorbed above the dashboard
    expect(r.route("ghost", "warn", "unknown tag")).toBe(true); // absorbed too

    r.stop();
    expect(r.route("home-reel", "info", "late")).toBe(false); // after teardown, logs print normally
  });
});

describe("renderSummary", () => {
  it("lists generated, cached, and failed assets with totals", () => {
    const outcomes: AssetOutcome[] = [
      { name: "home-reel", generator: "scroll-reel", status: "ok", records: [rec({ bytes: 2_400_000 })] },
      {
        name: "phone-frame",
        generator: "scene",
        status: "ok",
        cached: true,
        records: [rec({ width: 1170, height: 2532, bytes: 1_000_000 })],
      },
      { name: "broken", generator: "wall", status: "failed", records: [], error: new Error("nope") },
    ];
    const out = plain(renderSummary(outcomes, "pro-visu", 90));
    expect(out).toContain("home-reel");
    expect(out).toContain("1080×1920");
    expect(out).toContain("cached"); // the cached row
    expect(out).toContain("nope"); // the failure message
    expect(out).toContain("1 generated");
    expect(out).toContain("1 cached");
    expect(out).toContain("1 failed");
    expect(out).toContain("done with failures");
  });
});
