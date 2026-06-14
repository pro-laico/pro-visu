/**
 * A capture "variant" is one cell of the viewport × color-scheme matrix. A scroll-reel asset with
 * `viewports` and/or `colorScheme: "both"` expands into several variants, each emitted as its own
 * asset (the `suffix` is appended to the base name). The common case — no viewports, no `"both"` —
 * yields a single variant with an empty suffix (the asset keeps its base name).
 */
export interface VariantViewport {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

export interface CaptureVariant {
  width: number;
  height: number;
  deviceScaleFactor: number;
  colorScheme?: "light" | "dark";
  /** Appended to the base asset name / filename; "" for the single default variant. */
  suffix: string;
}

export interface BuildVariantsArgs {
  width: number;
  height: number;
  deviceScaleFactor: number;
  viewports?: VariantViewport[];
  colorScheme?: "light" | "dark" | "both";
}

/** Pure: expand the viewport × color-scheme matrix into capture variants. Unit-tested. */
export function buildVariants(o: BuildVariantsArgs): CaptureVariant[] {
  const viewports: VariantViewport[] =
    o.viewports && o.viewports.length > 0
      ? o.viewports
      : [{ name: "", width: o.width, height: o.height, deviceScaleFactor: o.deviceScaleFactor }];

  const schemes: Array<"light" | "dark" | undefined> =
    o.colorScheme === "both"
      ? ["light", "dark"]
      : o.colorScheme === "light" || o.colorScheme === "dark"
        ? [o.colorScheme]
        : [undefined];
  const multiScheme = schemes.length > 1;

  const out: CaptureVariant[] = [];
  for (const vp of viewports) {
    for (const scheme of schemes) {
      const suffix = [vp.name, multiScheme ? (scheme ?? "") : ""].filter((p) => p).join("-");
      out.push({
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: vp.deviceScaleFactor ?? o.deviceScaleFactor,
        colorScheme: scheme,
        suffix,
      });
    }
  }
  return out;
}
