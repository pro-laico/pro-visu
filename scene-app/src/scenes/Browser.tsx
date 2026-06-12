import type { SceneProps } from "../types";

/** A captured recording inside a browser-window mockup (title bar + address pill). */
export function Browser({ width, height, inputs, options }: SceneProps): React.ReactElement {
  const src = inputs.screen ?? Object.values(inputs)[0] ?? "";
  const frame = typeof options.frame === "string" ? options.frame : "#1b1b22";
  const label = typeof options.url === "string" ? options.url : "";

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
          boxShadow: "0 40px 110px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            height: barH,
            background: "#23232c",
            display: "flex",
            alignItems: "center",
            gap: dot * 0.8,
            padding: `0 ${barH * 0.5}px`,
          }}
        >
          <span style={{ width: dot, height: dot, borderRadius: 999, background: "#ff5f57" }} />
          <span style={{ width: dot, height: dot, borderRadius: 999, background: "#febc2e" }} />
          <span style={{ width: dot, height: dot, borderRadius: 999, background: "#28c840" }} />
          <div
            style={{
              flex: 1,
              height: barH * 0.5,
              margin: `0 ${barH * 0.4}px`,
              background: "#15151b",
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
