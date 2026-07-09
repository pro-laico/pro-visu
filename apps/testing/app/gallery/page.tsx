import path from "node:path";
import { readFile } from "node:fs/promises";

export const dynamic = "force-dynamic";

interface AssetRecord {
  id: string;
  generator: string;
  file: string;
  format: string;
  width: number;
  height: number;
  durationMs?: number;
}

async function loadAssets(): Promise<AssetRecord[] | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), "public", "pro-visu", "showcase", "manifest.json"), "utf8");
    const m = JSON.parse(raw) as { assets?: AssetRecord[] | Record<string, AssetRecord> }; //TODO: replace `as` cast with proper typing
    const assets = m.assets ?? (m as unknown as Record<string, AssetRecord>); //TODO: replace `as` cast with proper typing
    return Array.isArray(assets) ? assets : Object.values(assets);
  } catch {
    return null;
  }
}

export default async function Gallery() {
  const assets = await loadAssets();

  if (!assets || assets.length === 0) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Showcase gallery</h1>
        <p className="lead">
          No assets yet — run <code>pnpm --filter testing generate</code> first.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 40 }}>
      <h1 style={{ fontSize: 48 }}>Showcase gallery</h1>
      <p className="lead">{assets.length} generated assets</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24, marginTop: 32 }}>
        {assets.map((a) => {
          const src = `/pro-visu/showcase/${a.file}`;
          const isVideo = a.format === "mp4" || a.format === "webm";
          return (
            <figure key={a.id} style={{ margin: 0 }}>
              {isVideo ? (
                <video
                  src={src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ width: "100%", borderRadius: 12, background: "#000" }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={a.id} style={{ width: "100%", borderRadius: 12, background: "#000" }} />
              )}
              <figcaption style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
                {a.id} · {a.generator} · {a.format} {a.width}×{a.height}
                {a.durationMs ? ` · ${(a.durationMs / 1000).toFixed(1)}s` : ""}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </main>
  );
}
