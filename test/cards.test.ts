import { describe, expect, it } from "vitest";
import { cardHtml, escapeHtml } from "@/generators/scroll-reel/cards";

describe("escapeHtml", () => {
  it("escapes the HTML-significant characters", () => {
    expect(escapeHtml('a & b < c > d "e"')).toBe("a &amp; b &lt; c &gt; d &quot;e&quot;");
  });
});

describe("cardHtml", () => {
  it("embeds title + subtitle, size, and background", () => {
    const html = cardHtml({ title: "Hello", subtitle: "World", background: "#123456" }, 1920, 1080);
    expect(html).toContain("Hello");
    expect(html).toContain("World");
    expect(html).toContain("#123456");
    expect(html).toContain("width:1920px");
    expect(html).toContain("height:1080px");
  });

  it("escapes the title so markup can't be injected", () => {
    const html = cardHtml({ title: "<script>x</script>" }, 800, 600);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
