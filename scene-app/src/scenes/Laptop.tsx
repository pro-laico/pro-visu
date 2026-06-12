import type { SceneProps } from "../types";

/** A captured recording inside a laptop mockup (16:10 screen on a tapered base). */
export function Laptop({ width, height, inputs, options }: SceneProps): React.ReactElement {
  const src = inputs.screen ?? Object.values(inputs)[0] ?? "";
  const bezel = typeof options.bezel === "string" ? options.bezel : "#16161a";

  const screenW = Math.round(Math.min(width * 0.74, ((height * 0.78) * 16) / 10));
  const screenH = Math.round((screenW * 10) / 16);
  const bezelPad = Math.max(6, Math.round(screenW * 0.012));
  const baseW = Math.round(screenW * 1.12);
  const baseH = Math.max(10, Math.round(screenW * 0.022));

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: screenW,
          height: screenH,
          background: bezel,
          borderRadius: Math.round(screenW * 0.02),
          padding: bezelPad,
          boxShadow: "0 30px 90px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: Math.round(screenW * 0.012),
            overflow: "hidden",
            background: "#000",
          }}
        >
          {src ? (
            <video
              data-scene-video
              src={src}
              muted
              playsInline
              preload="auto"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : null}
        </div>
      </div>
      {/* base / hinge */}
      <div
        style={{
          width: baseW,
          height: baseH,
          background: bezel,
          borderRadius: `0 0 ${baseH}px ${baseH}px`,
          boxShadow: "0 18px 40px rgba(0,0,0,0.4)",
        }}
      />
      <div
        style={{
          width: Math.round(baseW * 0.16),
          height: Math.round(baseH * 0.45),
          background: "rgba(0,0,0,0.35)",
          borderRadius: `0 0 ${baseH}px ${baseH}px`,
        }}
      />
    </div>
  );
}
