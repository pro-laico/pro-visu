import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ManifestStore, readManifest, writeManifest } from "@/manifest/manifest";
import { sha256File } from "@/utils/hash";
import type { AssetRecord } from "@/manifest/schema";

const dirs: string[] = [];
async function tmp(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "showcase-mf-"));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  while (dirs.length) {
    await rm(dirs.pop()!, { recursive: true, force: true });
  }
});

function rec(id: string, over: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id,
    generator: "scroll-reel",
    sourceUrl: "https://x.com",
    file: `scroll-reel/${id}.mp4`,
    format: "mp4",
    width: 1280,
    height: 800,
    durationMs: 1000,
    bytes: 123,
    contentHash: "abc",
    createdAt: "2026-01-01T00:00:00.000Z",
    toolVersion: "0.0.0",
    ...over,
  };
}

describe("manifest", () => {
  it("is empty when no file exists", async () => {
    const dir = await tmp();
    expect((await readManifest(dir)).assets).toHaveLength(0);
  });

  it("upsert appends new ids and replaces existing ones", async () => {
    const dir = await tmp();
    const store = await ManifestStore.load(dir);
    await store.upsert(rec("a", { bytes: 1 }));
    await store.upsert(rec("b", { bytes: 2 }));
    await store.upsert(rec("a", { bytes: 999 }));

    const manifest = await readManifest(dir);
    expect(manifest.assets).toHaveLength(2);
    expect(manifest.assets.find((a) => a.id === "a")!.bytes).toBe(999);
  });

  it("writeManifest sorts assets by id", async () => {
    const dir = await tmp();
    await writeManifest(dir, { version: 1, assets: [rec("z"), rec("a"), rec("m")] });
    const manifest = await readManifest(dir);
    expect(manifest.assets.map((a) => a.id)).toEqual(["a", "m", "z"]);
  });

  it("throws on corrupt manifest json", async () => {
    const dir = await tmp();
    await writeFile(path.join(dir, "manifest.json"), "{ not json", "utf8");
    await expect(readManifest(dir)).rejects.toThrow();
  });
});

describe("hashing", () => {
  it("sha256File matches the known digest of 'hello'", async () => {
    const dir = await tmp();
    const file = path.join(dir, "f.txt");
    await writeFile(file, "hello", "utf8");
    expect(await sha256File(file)).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});
