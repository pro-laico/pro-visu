import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { detectPackageManager, pmRun } from "@/utils/package-manager";

const dirs: string[] = [];
async function tmp(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pv-pm-"));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  while (dirs.length) await rm(dirs.pop()!, { recursive: true, force: true });
});

describe("pmRun", () => {
  it("uses `npm run <script>` for npm and `<pm> <script>` for the rest", () => {
    expect(pmRun("npm", "build")).toBe("npm run build");
    expect(pmRun("npm", "start")).toBe("npm run start");
    expect(pmRun("pnpm", "build")).toBe("pnpm build");
    expect(pmRun("pnpm", "start")).toBe("pnpm start");
    expect(pmRun("yarn", "build")).toBe("yarn build");
    expect(pmRun("bun", "start")).toBe("bun start");
  });
});

describe("detectPackageManager", () => {
  it("prefers the packageManager field", async () => {
    const dir = await tmp();
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ packageManager: "yarn@4.1.0" }), "utf8");
    await writeFile(path.join(dir, "pnpm-lock.yaml"), "", "utf8"); // field wins over the lockfile
    expect(detectPackageManager(dir)).toBe("yarn");
  });

  it("falls back to the lockfile", async () => {
    const dir = await tmp();
    await writeFile(path.join(dir, "pnpm-lock.yaml"), "", "utf8");
    expect(detectPackageManager(dir)).toBe("pnpm");
  });

  it("defaults to npm when nothing is detectable", async () => {
    const dir = await tmp();
    expect(detectPackageManager(dir)).toBe("npm");
  });
});
