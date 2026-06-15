import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ConfigNotFoundError,
  ConfigValidationError,
  loadShowcaseConfig,
} from "@/config/load";
import { scrollReelOptionsSchema } from "@/generators/scroll-reel/options";
import { mergeGeneratorOptions } from "@/pipeline/runner";

const dirs: string[] = [];
async function tmp(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "showcase-cfg-"));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  while (dirs.length) {
    await rm(dirs.pop()!, { recursive: true, force: true });
  }
});

const base = {
  assets: [{ name: "a", url: "https://example.com", generator: "scroll-reel" }],
};

describe("config discovery", () => {
  it("loads showcase.config.json and applies setting defaults", async () => {
    const dir = await tmp();
    await writeFile(path.join(dir, "showcase.config.json"), JSON.stringify(base), "utf8");
    const { config } = await loadShowcaseConfig({ cwd: dir });
    expect(config.assets[0]!.name).toBe("a");
    expect(config.settings.outDir).toBe("showcase");
    expect(config.settings.concurrency).toBe(2);
    expect(config.settings.browser.headless).toBe(true);
  });

  it("loads .showcaserc", async () => {
    const dir = await tmp();
    await writeFile(path.join(dir, ".showcaserc"), JSON.stringify(base), "utf8");
    const { config } = await loadShowcaseConfig({ cwd: dir });
    expect(config.assets).toHaveLength(1);
  });

  it("loads a package.json showcase key", async () => {
    const dir = await tmp();
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "x", showcase: base }),
      "utf8",
    );
    const { config } = await loadShowcaseConfig({ cwd: dir });
    expect(config.assets[0]!.url).toContain("example.com");
  });

  it("loads a TypeScript config via jiti", async () => {
    const dir = await tmp();
    await writeFile(
      path.join(dir, "showcase.config.ts"),
      `export default ${JSON.stringify(base)};`,
      "utf8",
    );
    const { config, configFile } = await loadShowcaseConfig({ cwd: dir });
    expect(configFile).toContain("showcase.config.ts");
    expect(config.assets).toHaveLength(1);
  });

  it("honors an explicit --config path", async () => {
    const dir = await tmp();
    const custom = path.join(dir, "custom.config.ts");
    await writeFile(custom, `export default ${JSON.stringify(base)};`, "utf8");
    const { config } = await loadShowcaseConfig({ cwd: dir, configFile: custom });
    expect(config.assets).toHaveLength(1);
  });
});

describe("config validation", () => {
  it("throws ConfigNotFoundError when nothing is present", async () => {
    const dir = await tmp();
    await expect(loadShowcaseConfig({ cwd: dir })).rejects.toBeInstanceOf(
      ConfigNotFoundError,
    );
  });

  it("rejects empty assets", async () => {
    const dir = await tmp();
    await writeFile(
      path.join(dir, "showcase.config.json"),
      JSON.stringify({ assets: [] }),
      "utf8",
    );
    await expect(loadShowcaseConfig({ cwd: dir })).rejects.toBeInstanceOf(
      ConfigValidationError,
    );
  });

  it("rejects duplicate asset names", async () => {
    const dir = await tmp();
    const cfg = {
      assets: [
        { name: "dup", url: "https://a.com", generator: "scroll-reel" },
        { name: "dup", url: "https://b.com", generator: "scroll-reel" },
      ],
    };
    await writeFile(path.join(dir, "showcase.config.json"), JSON.stringify(cfg), "utf8");
    await expect(loadShowcaseConfig({ cwd: dir })).rejects.toBeInstanceOf(
      ConfigValidationError,
    );
  });
});

describe("option precedence", () => {
  it("per-asset options win over settings.defaults, then schema defaults fill", () => {
    // Exercise the real runner merge: settings.defaults (keyed by generator id) sit under
    // per-asset options, and the schema fills whatever neither of them sets.
    const merged = mergeGeneratorOptions(
      { "scroll-reel": { width: 100, fps: 24 } },
      { name: "a", url: "https://a.com", generator: "scroll-reel", options: { width: 200 }, inputs: {} },
    );
    const opts = scrollReelOptionsSchema.parse(merged);
    expect(opts.width).toBe(200); // asset option wins over settings.defaults
    expect(opts.fps).toBe(24); // falls through from settings.defaults
    expect(opts.height).toBe(800); // neither set it → schema default
  });
});
