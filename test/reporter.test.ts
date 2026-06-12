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
    expect(text()).toContain("esc to cancel"); // footer hint

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

  it("keeps rows within the terminal width and collapses multi-line steps (no redraw drift)", () => {
    const { stream, text } = fakeStream(); // columns: 80
    const r = new LiveReporter(stream);
    r.begin();
    r.add({ id: "@build", name: "build", detail: "server", system: true });
    r.status("@build", "running");
    // A long, multi-line step like routed build output — must not fill `cols` (would auto-wrap and
    // corrupt the cursor-up redraw) and must render as a single physical line.
    r.route("@build", "info", "ok\nprerendered as static HTML " + "x".repeat(500));
    r.status("@build", "running"); // force a render with the long step
    r.stop();
    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
    for (const ln of stripAnsi(text()).split("\n")) {
      expect(ln.length).toBeLessThan(80); // strictly under cols → terminal won't wrap the row
    }
    expect(stripAnsi(text())).toContain("ok prerendered"); // newline collapsed to a space
  });

  it("flips the footer to a 'cancelling…' banner once cancellation is requested", () => {
    const { stream, text } = fakeStream();
    const r = new LiveReporter(stream);
    r.begin();
    r.add({ id: "a", name: "a", detail: "scene" });
    r.add({ id: "b", name: "b", detail: "scene" });
    r.status("a", "running");
    r.status("b", "running");
    expect(text()).toContain("esc to cancel");

    const before = text().length;
    r.cancelling();
    const after = text().slice(before);
    expect(after).toContain("cancelling…"); // banner replaces the idle hint
    expect(after).toContain("finishing 2"); // names the in-flight count
    expect(after).not.toContain("esc to cancel");
    r.stop();
  });

  it("keeps rows under the terminal width when the asset name is very long (no redraw wall)", () => {
    const { stream, text } = fakeStream(); // columns: 80
    const r = new LiveReporter(stream);
    r.begin();
    // A filename far longer than the name column — padEnd alone would overrun cols and wrap.
    const longName = "font-specimen-demo-intense-with-a-really-really-long-name-3";
    r.add({ id: longName, name: longName, detail: "specimen" });
    r.status(longName, "running");
    r.route(longName, "info", "rendering scene \"specimen\" (realtime)");
    r.status(longName, "running"); // force a render with the long name + step
    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
    for (const ln of stripAnsi(text()).split("\n")) {
      expect(ln.length).toBeLessThan(80); // strictly under cols → terminal won't wrap the row
    }
    expect(stripAnsi(text())).toContain("…"); // the long name was ellipsized, not overrun
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
