import { describe, expect, it } from "vitest";
import {
  buildCleanCss,
  shouldBlockRequest,
  DEFAULT_TRACKER_HOSTS,
} from "@/pipeline/clean-capture";

const NONE = {
  hideSelectors: [] as string[],
  hideScrollbars: false,
  pauseAnimations: false,
};

describe("buildCleanCss", () => {
  it("returns an empty string when nothing is requested", () => {
    expect(buildCleanCss(NONE)).toBe("");
    expect(buildCleanCss({ ...NONE, injectCss: "   " })).toBe("");
  });

  it("hides each selector with display:none !important, comma-joined", () => {
    const css = buildCleanCss({ ...NONE, hideSelectors: ["#cookie", ".chat-widget"] });
    expect(css).toContain("#cookie, .chat-widget");
    expect(css).toContain("display: none !important");
  });

  it("hides scrollbars across engines", () => {
    const css = buildCleanCss({ ...NONE, hideScrollbars: true });
    expect(css).toContain("::-webkit-scrollbar");
    expect(css).toContain("scrollbar-width: none");
  });

  it("pauses animations and transitions", () => {
    const css = buildCleanCss({ ...NONE, pauseAnimations: true });
    expect(css).toContain("animation-play-state: paused !important");
    expect(css).toContain("transition: none !important");
  });

  it("appends author CSS verbatim, last", () => {
    const css = buildCleanCss({ ...NONE, injectCss: "body { background: #000 }" });
    expect(css).toContain("body { background: #000 }");
    expect(css.trimEnd().endsWith("body { background: #000 }")).toBe(true);
  });

  it("combines multiple sections separated by newlines", () => {
    const css = buildCleanCss({
      hideSelectors: ["#x"],
      hideScrollbars: true,
      pauseAnimations: true,
      injectCss: "h1 { color: red }",
    });
    expect(css.split("\n").length).toBeGreaterThanOrEqual(4);
    expect(css).toContain("#x");
    expect(css).toContain("::-webkit-scrollbar");
    expect(css).toContain("animation-play-state");
    expect(css).toContain("h1 { color: red }");
  });
});

describe("shouldBlockRequest", () => {
  it("blocks by resource type", () => {
    expect(
      shouldBlockRequest("https://example.com/clip.mp4", {
        hosts: [],
        resourceTypes: ["media"],
        resourceType: "media",
      }),
    ).toBe(true);
  });

  it("blocks a known tracker host", () => {
    expect(
      shouldBlockRequest("https://www.google-analytics.com/collect", {
        hosts: DEFAULT_TRACKER_HOSTS,
        resourceTypes: [],
        resourceType: "script",
      }),
    ).toBe(true);
  });

  it("allows first-party requests through", () => {
    expect(
      shouldBlockRequest("https://prolaico.com/app.js", {
        hosts: DEFAULT_TRACKER_HOSTS,
        resourceTypes: [],
        resourceType: "script",
      }),
    ).toBe(false);
  });
});
