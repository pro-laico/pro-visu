import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
/** Write a config file into the `pro-visu/` folder that discovery scans (creating it first). */
async function writeCfg(dir: string, name: string, data: unknown): Promise<void> {
  const cfgDir = path.join(dir, "pro-visu");
  await mkdir(cfgDir, { recursive: true });
  await writeFile(path.join(cfgDir, name), typeof data === "string" ? data : JSON.stringify(data), "utf8");
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
  it("loads pro-visu/pro-visu.config.json and applies setting defaults", async () => {
    const dir = await tmp();
    await writeCfg(dir, "pro-visu.config.json", base);
    const { config } = await loadShowcaseConfig({ cwd: dir });
    expect(config.assets[0]!.name).toBe("a");
    expect(config.settings.outDir).toBe("output");
    expect(config.settings.concurrency).toBe(1);
    expect(config.settings.browser.headless).toBe(true);
  });

  it("loads pro-visu/.pro-visurc", async () => {
    const dir = await tmp();
    await writeCfg(dir, ".pro-visurc", base);
    const { config } = await loadShowcaseConfig({ cwd: dir });
    expect(config.assets).toHaveLength(1);
  });

  it("loads a TypeScript config via jiti", async () => {
    const dir = await tmp();
    await writeCfg(dir, "pro-visu.config.ts", `export default ${JSON.stringify(base)};`);
    const { config, configFile } = await loadShowcaseConfig({ cwd: dir });
    expect(configFile?.replace(/\\/g, "/")).toContain("/pro-visu/pro-visu.config.ts");
    expect(config.assets).toHaveLength(1);
  });

  it("does NOT discover a config at the repo root (must live in pro-visu/)", async () => {
    const dir = await tmp();
    await writeFile(path.join(dir, "pro-visu.config.json"), JSON.stringify(base), "utf8");
    await expect(loadShowcaseConfig({ cwd: dir })).rejects.toBeInstanceOf(ConfigNotFoundError);
  });

  it("honors an explicit --config path (escapes the folder convention)", async () => {
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
    await writeCfg(dir, "pro-visu.config.json", { assets: [] });
    await expect(loadShowcaseConfig({ cwd: dir })).rejects.toBeInstanceOf(
      ConfigValidationError,
    );
  });

  it("rejects duplicate asset names", async () => {
    const dir = await tmp();
    await writeCfg(dir, "pro-visu.config.json", {
      assets: [
        { name: "dup", url: "https://a.com", generator: "scroll-reel" },
        { name: "dup", url: "https://b.com", generator: "scroll-reel" },
      ],
    });
    await expect(loadShowcaseConfig({ cwd: dir })).rejects.toBeInstanceOf(
      ConfigValidationError,
    );
  });

  it("rejects typo'd keys in settings (strict)", async () => {
    const dir = await tmp();
    await writeCfg(dir, "pro-visu.config.json", {
      settings: { concurrancy: 4 },
      assets: [{ name: "a", url: "https://a.com", generator: "scroll-reel" }],
    });
    await expect(loadShowcaseConfig({ cwd: dir })).rejects.toBeInstanceOf(
      ConfigValidationError,
    );
  });

  it("rejects typo'd keys at the config root (strict), but allows $schema", async () => {
    const dir = await tmp();
    await writeCfg(dir, "pro-visu.config.json", {
      setttings: {},
      assets: [{ name: "a", url: "https://a.com", generator: "scroll-reel" }],
    });
    await expect(loadShowcaseConfig({ cwd: dir })).rejects.toBeInstanceOf(
      ConfigValidationError,
    );

    const dir2 = await tmp();
    await writeCfg(dir2, "pro-visu.config.json", {
      $schema: "./pro-visu.schema.json",
      assets: [{ name: "a", url: "https://a.com", generator: "scroll-reel" }],
    });
    const { config } = await loadShowcaseConfig({ cwd: dir2 });
    expect(config.assets).toHaveLength(1);
  });
});

describe("option precedence", () => {
  it("per-asset options win over settings.defaults, then schema defaults fill", () => {
    // Exercise the real runner merge: settings.defaults (keyed by generator id) sit under
    // per-asset options, and the schema fills whatever neither of them sets.
    const merged = mergeGeneratorOptions(
      { "scroll-reel": { output: { width: 100, fps: 24 } } },
      { name: "a", url: "https://a.com", generator: "scroll-reel", options: { output: { width: 200 } }, inputs: {}, enabled: true },
    );
    const opts = scrollReelOptionsSchema.parse(merged);
    expect(opts.output.width).toBe(200); // asset option wins over settings.defaults
    expect(opts.output.fps).toBe(24); // falls through from settings.defaults
    expect(opts.output.height).toBe(800); // neither set it → schema default
  });
});
