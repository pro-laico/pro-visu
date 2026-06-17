import { describe, expect, it } from "vitest";
import { buildVariants } from "@/generators/scroll-reel/variants";

const base = { width: 1280, height: 800, deviceScaleFactor: 2 };

describe("buildVariants", () => {
  it("yields a single empty-suffix variant by default", () => {
    const v = buildVariants({ ...base });
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ width: 1280, height: 800, deviceScaleFactor: 2, suffix: "" });
    expect(v[0]!.colorScheme).toBeUndefined();
  });

  it("single colorScheme applies without adding a suffix", () => {
    const v = buildVariants({ ...base, colorScheme: "dark" });
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ colorScheme: "dark", suffix: "" });
  });

  it("expands colorScheme:both into light + dark", () => {
    const v = buildVariants({ ...base, colorScheme: "both" });
    expect(v.map((x) => x.suffix)).toEqual(["light", "dark"]);
    expect(v.map((x) => x.colorScheme)).toEqual(["light", "dark"]);
  });

  it("expands viewports, inheriting deviceScaleFactor when omitted", () => {
    const v = buildVariants({
      ...base,
      viewports: [
        { name: "desktop", width: 1440, height: 900 },
        { name: "mobile", width: 390, height: 844, deviceScaleFactor: 3 },
      ],
    });
    expect(v.map((x) => x.suffix)).toEqual(["desktop", "mobile"]);
    expect(v[0]).toMatchObject({ width: 1440, height: 900, deviceScaleFactor: 2 });
    expect(v[1]).toMatchObject({ width: 390, height: 844, deviceScaleFactor: 3 });
  });

  it("crosses viewports × colorScheme:both", () => {
    const v = buildVariants({
      ...base,
      colorScheme: "both",
      viewports: [
        { name: "d", width: 1440, height: 900 },
        { name: "m", width: 390, height: 844 },
      ],
    });
    expect(v.map((x) => x.suffix)).toEqual(["d-light", "d-dark", "m-light", "m-dark"]);
  });
});
