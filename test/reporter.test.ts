import { describe, expect, it } from "vitest";
import { formatElapsed, truncate } from "@/pipeline/reporter";
import { LiveReporter, NoopReporter, createReporter } from "@/cli/live-reporter";

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

/** Minimal stdout-like sink that records everything written. */
function fakeStream() {
  const writes: string[] = [];
  const stream = {
    columns: 80,
    write(s: string) {
      writes.push(s);
      return true;
    },
  };
  return { stream: stream as unknown as NodeJS.WriteStream, text: () => writes.join("") };
}

describe("LiveReporter", () => {
  it("renders a row per task and reflects status transitions", () => {
    const { stream, text } = fakeStream();
    const r = new LiveReporter(stream);
    r.begin();
    r.add({ id: "@build", name: "build", detail: "server", system: true });
    r.add({ id: "home-reel", name: "home-reel", detail: "scroll-reel" });
    r.add({ id: "phone-frame", name: "phone-frame", detail: "scene", deps: ["home-reel"] });
    expect(text()).toContain("build");
    expect(text()).toContain("home-reel");
    expect(text()).toContain("waiting on home-reel");

    r.status("home-reel", "running");
    r.route("home-reel", "info", "recording…");
    r.status("home-reel", "ok");
    expect(text()).toContain("✓"); // ok glyph
    expect(text()).toContain("recording…");

    r.stop();
    expect(text()).toContain("\x1b[?25h"); // cursor restored
  });

  it("shows gated jobs as 'waiting for build' until setup completes", () => {
    const { stream, text } = fakeStream();
    const r = new LiveReporter(stream);
    r.begin();
    r.add({ id: "@build", name: "build", detail: "server", system: true });
    r.add({ id: "@server", name: "server", detail: "server", system: true });
    r.add({
      id: "home-reel",
      name: "home-reel",
      detail: "scroll-reel",
      gatedBy: ["@build", "@server"],
    });
    expect(text()).toContain("waiting for build, server");

    r.status("@build", "ok");
    r.status("@server", "ok"); // gates done → no asset deps → queued
    const before = text().length;
    r.status("home-reel", "running"); // force a fresh render
    expect(text().slice(before)).toContain("home-reel");
    r.stop();
  });

  it("declines to route tags it doesn't own", () => {
    const { stream } = fakeStream();
    const r = new LiveReporter(stream);
    r.begin();
    r.add({ id: "a", name: "a", detail: "scroll-reel" });
    expect(r.route("a", "info", "x")).toBe(true);
    expect(r.route("not-a-job", "info", "x")).toBe(false);
    r.stop();
  });
});

describe("createReporter", () => {
  it("is no-op without a TTY and live with one", () => {
    delete process.env.SHOWCASE_LIVE;
    expect(createReporter({ tty: false, verbose: false })).toBeInstanceOf(NoopReporter);
    expect(createReporter({ tty: true, verbose: false })).toBeInstanceOf(LiveReporter);
    expect(createReporter({ tty: true, verbose: true })).toBeInstanceOf(NoopReporter);
  });
});
