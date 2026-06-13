import type { SceneProps } from "../types";

/** A captured recording composited inside a phone mockup, centered on the backdrop. */
export function Phone({ height, inputs, options }: SceneProps): React.ReactElement {
  const src = inputs.screen ?? Object.values(inputs)[0] ?? "";
  const bezel = typeof options.bezel === "string" ? options.bezel : "#0a0a0a";
  const shadow = typeof options.shadow === "string" ? options.shadow : "0 40px 120px rgba(0,0,0,0.5)";
  const radiusScale = typeof options.radiusScale === "number" ? options.radiusScale : 1;
  const screenBackground =
    typeof options.screenBackground === "string" ? options.screenBackground : "#000";

  const phoneH = Math.round(height * 0.92);
  const phoneW = Math.round((phoneH * 9) / 19.5);
  const radius = Math.round(phoneW * 0.13 * radiusScale);
  const pad = Math.max(6, Math.round(phoneW * 0.028));

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
          width: phoneW,
          height: phoneH,
          background: bezel,
          borderRadius: radius,
          padding: pad,
          boxShadow: shadow,
          position: "relative",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: radius - pad,
            overflow: "hidden",
            background: screenBackground,
            position: "relative",
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
          <div
            style={{
              position: "absolute",
              top: pad,
              left: "50%",
              transform: "translateX(-50%)",
              width: phoneW * 0.32,
              height: pad * 2.2,
              background: bezel,
              borderRadius: 999,
            }}
          />
        </div>
      </div>
    </div>
  );
}
