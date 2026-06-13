import type { SceneProps } from "../types";

/** A captured recording inside a browser-window mockup (title bar + address pill). */
export function Browser({ width, height, inputs, options }: SceneProps): React.ReactElement {
  const src = inputs.screen ?? Object.values(inputs)[0] ?? "";
  const frame = typeof options.frame === "string" ? options.frame : "#1b1b22";
  const label = typeof options.url === "string" ? options.url : "";
  const showDots = options.dots !== false; // default on
  const dotColors =
    Array.isArray(options.dotColors) && options.dotColors.length === 3
      ? (options.dotColors as [string, string, string])
      : (["#ff5f57", "#febc2e", "#28c840"] as const);
  const barColor = typeof options.barColor === "string" ? options.barColor : "#23232c";
  const addressBarColor =
    typeof options.addressBarColor === "string" ? options.addressBarColor : "#15151b";
  const shadow = typeof options.shadow === "string" ? options.shadow : "0 40px 110px rgba(0,0,0,0.5)";

  const winW = Math.round(Math.min(width * 0.88, ((height * 0.86) * 16) / 10));
  const barH = Math.max(28, Math.round(winW * 0.05));
  const dot = Math.round(barH * 0.26);
  const radius = Math.round(winW * 0.014);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: winW,
          background: frame,
          border: "1px solid #2c2c36",
          borderRadius: radius,
          overflow: "hidden",
          boxShadow: shadow,
        }}
      >
        <div
          style={{
            height: barH,
            background: barColor,
            display: "flex",
            alignItems: "center",
            gap: dot * 0.8,
            padding: `0 ${barH * 0.5}px`,
          }}
        >
          {showDots && (
            <>
              <span style={{ width: dot, height: dot, borderRadius: 999, background: dotColors[0] }} />
              <span style={{ width: dot, height: dot, borderRadius: 999, background: dotColors[1] }} />
              <span style={{ width: dot, height: dot, borderRadius: 999, background: dotColors[2] }} />
            </>
          )}
          <div
            style={{
              flex: 1,
              height: barH * 0.5,
              margin: `0 ${barH * 0.4}px`,
              background: addressBarColor,
              borderRadius: 999,
              color: "#8a8a96",
              fontSize: barH * 0.28,
              fontFamily: "system-ui, sans-serif",
              display: "flex",
              alignItems: "center",
              padding: `0 ${barH * 0.5}px`,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </div>
        </div>
        <div style={{ lineHeight: 0, background: "#000" }}>
          {src ? (
            <video
              data-scene-video
              src={src}
              muted
              playsInline
              preload="auto"
              style={{ width: "100%", display: "block" }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
