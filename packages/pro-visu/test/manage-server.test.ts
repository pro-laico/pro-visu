import os from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { serverSettingsSchema } from "@/config/schema";
import { startManagedServer } from "@/server/manage-server";
import { createLogger } from "@/utils/logger";

// These tests drive the REAL lifecycle: they spawn actual child processes (via shell, like the
// CLI does) and tear them down cross-platform. No mocking — only resolveServerUrl + the schema
// were covered before; this exercises spawn → readiness poll → killTree.
const log = createLogger("silent");

const dirs: string[] = [];
async function tmp(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "showcase-srv-"));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  while (dirs.length) await rm(dirs.pop()!, { recursive: true, force: true });
});

/** Ask the OS for an unused TCP port (closed again before we hand it back). */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

/** True if the url answers an HTTP request right now. */
function reachable(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/** Poll until the url's reachability matches `want`, or the timeout elapses. */
async function waitUntil(want: boolean, url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await reachable(url)) === want) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return (await reachable(url)) === want;
}

/** Write a tiny CommonJS http server that listens on argv[2]; returns its path. */
async function writeHttpServer(dir: string): Promise<string> {
  const file = path.join(dir, "server.cjs");
  await writeFile(
    file,
    `const http = require("http");
const port = Number(process.argv[2]);
http.createServer((_req, res) => { res.statusCode = 200; res.end("ok"); }).listen(port, "127.0.0.1");
`,
    "utf8",
  );
  return file;
}

describe("startManagedServer", () => {
  it("reuses an already-running server without spawning the command", async () => {
    const port = await freePort();
    const existing = http.createServer((_req, res) => res.end("ok"));
    await new Promise<void>((r) => existing.listen(port, "127.0.0.1", () => r()));
    try {
      const server = serverSettingsSchema.parse({
        command: "showcase-should-not-spawn", // reuse short-circuits before this would run
        port,
        reuseExisting: true,
      });
      const handle = await startManagedServer(server, await tmp(), log);
      expect(handle).toBeNull(); // reused → null handle, command never spawned
    } finally {
      await new Promise<void>((r) => existing.close(() => r()));
    }
  });

  it("runs a build, starts the server, waits for readiness, then stop() tears the tree down", async () => {
    const dir = await tmp();
    const port = await freePort();
    const serverJs = await writeHttpServer(dir);
    const url = `http://127.0.0.1:${port}`;
    const server = serverSettingsSchema.parse({
      build: "exit 0", // runOnce success path
      command: `node "${serverJs}" ${port}`,
      port,
      reuseExisting: false,
      readyTimeoutMs: 15000,
    });

    const handle = await startManagedServer(server, dir, log);
    expect(handle).not.toBeNull();
    expect(typeof handle?.pid).toBe("number");
    expect(await reachable(url)).toBe(true); // the server is genuinely up

    await handle!.stop();
    expect(await waitUntil(false, url, 8000)).toBe(true); // tree killed → port stops answering
  }, 30000);

  // Windows: a shell-spawned child's `exit` event fires even while the underlying node process
  // keeps running, so the readiness failure always reports via the "exited" branch and the pure
  // timeout branch can't be reached. It IS reachable on POSIX (the shell child stays alive), so
  // run it there — the killTree-on-failure path is covered cross-platform by the exit test above.
  it.skipIf(process.platform === "win32")(
    "fails when a running server never becomes reachable before the timeout",
    async () => {
      const dir = await tmp();
      const keepAlive = path.join(dir, "keepalive.cjs");
      await writeFile(
        keepAlive,
        `const http = require("http");
const s = http.createServer((_q, r) => r.end("ok"));
s.on("error", () => {});
s.listen(0, "127.0.0.1"); // random port — never the one we poll
setInterval(() => {}, 1000); // belt-and-suspenders: keep the event loop open
`,
        "utf8",
      );
      const port = await freePort(); // nothing ever listens here
      const server = serverSettingsSchema.parse({
        command: `node "${keepAlive}"`,
        port,
        reuseExisting: false,
        readyTimeoutMs: 1200,
      });
      await expect(startManagedServer(server, dir, log)).rejects.toThrow(/did not become reachable/);
    },
    15000,
  );

  it("fails fast when the command exits before becoming reachable", async () => {
    const dir = await tmp();
    const port = await freePort();
    const server = serverSettingsSchema.parse({
      command: "exit 0", // exits immediately without ever listening
      port,
      reuseExisting: false,
      readyTimeoutMs: 1200,
    });
    await expect(startManagedServer(server, dir, log)).rejects.toThrow(/exited before/);
  }, 15000);

  it("surfaces a failing build and never starts the server", async () => {
    const dir = await tmp();
    const port = await freePort();
    const server = serverSettingsSchema.parse({
      build: "exit 3", // non-zero build aborts before the server is spawned
      command: "showcase-should-not-spawn",
      port,
      reuseExisting: false,
      readyTimeoutMs: 1000,
    });
    await expect(startManagedServer(server, dir, log)).rejects.toThrow(/exit 3/);
  }, 15000);
});
