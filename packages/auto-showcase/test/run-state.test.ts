import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  startRunState,
  updateRunState,
  readRunState,
  clearRunState,
  isAlive,
  killTreeByPid,
} from "@/cli/run-state";

describe("run-state file", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "rs-test-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("starts, merges patches (deduping tmpDirs), then clears", async () => {
    await startRunState(dir);
    expect((await readRunState(dir))?.pid).toBe(process.pid);

    await updateRunState(dir, { serverPid: 4242 });
    await updateRunState(dir, { tmpDirs: ["/tmp/a"] });
    await updateRunState(dir, { tmpDirs: ["/tmp/a", "/tmp/b"] }); // /tmp/a deduped
    const s = await readRunState(dir);
    expect(s?.serverPid).toBe(4242);
    expect(s?.tmpDirs).toEqual(["/tmp/a", "/tmp/b"]);

    await clearRunState(dir);
    expect(await readRunState(dir)).toBeNull();
  });

  it("reads null when there's no run-state file", async () => {
    expect(await readRunState(dir)).toBeNull();
  });
});

describe("process control", () => {
  it("isAlive reflects the current process and rejects bad pids", () => {
    expect(isAlive(process.pid)).toBe(true);
    expect(isAlive(0)).toBe(false);
  });

  it("killTreeByPid is a no-op for missing/dead pids", async () => {
    expect(await killTreeByPid(undefined)).toBe(false);
    expect(await killTreeByPid(0)).toBe(false);
  });

  it("kills a real child process tree", async () => {
    const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], {
      stdio: "ignore",
    });
    await new Promise<void>((resolve) => child.once("spawn", () => resolve()));
    const pid = child.pid as number;
    expect(isAlive(pid)).toBe(true);

    expect(await killTreeByPid(pid)).toBe(true);
    const deadline = Date.now() + 5000;
    while (isAlive(pid) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
    expect(isAlive(pid)).toBe(false);
    child.removeAllListeners();
  });
});
