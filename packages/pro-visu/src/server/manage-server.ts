import path from "node:path";
import http from "node:http";
import https from "node:https";
import { spawn, type ChildProcess } from "node:child_process";

import type { Logger } from "@/utils/logger";
import type { ResolvedServerSettings } from "@/config/schema";
import { detectPackageManager, pmRun } from "@/utils/package-manager";

/** A started server we own and must tear down (null when we reused an existing one). */
export interface ServerHandle {
  stop: () => Promise<void>;
  /** Process id of the spawned server tree's root (for orphan cleanup after a hard kill). */
  pid?: number;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resolve the readiness URL from explicit url or port. */
export function resolveServerUrl(server: ResolvedServerSettings): string {
  return server.url ?? `http://127.0.0.1:${server.port}`;
}

/** Single GET; resolves true if the server answered at all (any status code). */
function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const lib = url.startsWith("https:") ? https : http;
    const req = lib.get(url, (res) => {
      res.resume();
      resolve((res.statusCode ?? 0) > 0);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForUrl(url: string, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) return false;
    if (await probe(url)) return true;
    await delay(500);
  }
  return false;
}

/** A row in the live tracker the server lifecycle can drive (build / server steps). */
export interface TaskHandle {
  /** Mark the row active (spinner + ticking elapsed). */
  start(): void;
  step(text: string): void;
  ok(): void;
  fail(): void;
}

export interface ServerTasks {
  build?: TaskHandle;
  server?: TaskHandle;
}

/**
 * Run a one-shot command (e.g. a build) to completion, rejecting on non-zero exit. With a
 * `task`, output is captured and the latest line feeds the tracker row (instead of streaming
 * raw to the terminal); the captured tail is included in the error on failure.
 */
function runOnce(command: string, cwd: string, task?: TaskHandle, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Aborted."));
    const tracked = Boolean(task);
    const child = spawn(command, { cwd, shell: true, stdio: tracked ? ["ignore", "pipe", "pipe"] : "inherit" });
    let tail = "";
    const onData = (b: Buffer): void => {
      const text = b.toString();
      tail = (tail + text).slice(-4000);
      const last = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).at(-1);
      if (last) task?.step(last);
    };
    if (tracked) {
      child.stdout?.on("data", onData);
      child.stderr?.on("data", onData);
    }
    const onAbort = (): void => {
      void killTree(child);
      reject(new Error("Aborted."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    const settle = (fn: () => void): void => {
      signal?.removeEventListener("abort", onAbort);
      fn();
    };
    child.on("error", (err) => settle(() => reject(err)));
    child.on("close", (code) =>
      settle(() =>
        code === 0
          ? resolve()
          : reject(
              new Error(
                `"${command}" failed (exit ${code}).${tracked ? `\n${tail.slice(-1500)}` : ""}`,
              ),
            ),
      ),
    );
  });
}

/** Kill a process and its whole tree, cross-platform. */
function killTree(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.pid == null || child.exitCode != null) return resolve();
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      killer.on("error", () => resolve());
      killer.on("close", () => resolve());
    } else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        try {
          child.kill("SIGTERM");
        } catch {}
      }
      resolve();
    }
  });
}

/**
 * Ensure a server is reachable for the capture. If one is already up (and reuseExisting),
 * returns null — we leave it alone. Otherwise optionally builds, starts the server, waits for
 * readiness, and returns a handle whose stop() tears it (and its children) down.
 */
export async function startManagedServer(
  server: ResolvedServerSettings,
  baseCwd: string,
  logger: Logger,
  tasks: ServerTasks = {},
  signal?: AbortSignal,
): Promise<ServerHandle | null> {
  const cwd = server.cwd ? path.resolve(baseCwd, server.cwd) : baseCwd;
  const url = resolveServerUrl(server);

  const pm = detectPackageManager(cwd);
  const buildCmd = server.build === false ? undefined : (server.build ?? pmRun(pm, "build"));
  const startCmd = server.command ?? pmRun(pm, "start");

  const live = Boolean(tasks.build || tasks.server);

  if (server.reuseExisting && (await probe(url))) {
    if (live) {
      tasks.build?.step("reused");
      tasks.build?.ok();
      tasks.server?.step(`reusing existing server at ${url}`);
      tasks.server?.ok();
    } else {
      logger.info(`Reusing the server already running at ${url}`);
    }
    return null;
  }

  if (buildCmd) {
    if (live) {
      tasks.build?.start();
      tasks.build?.step(`building (${buildCmd})…`);
    } else {
      logger.info(`Building: ${buildCmd}`);
    }
    try {
      await runOnce(buildCmd, cwd, tasks.build, signal);
    } catch (err) {
      tasks.build?.fail();
      throw err;
    }
    tasks.build?.ok();
  }

  if (live) {
    tasks.server?.start();
    tasks.server?.step(`starting (${startCmd})…`);
  } else {
    logger.info(`Starting server: ${startCmd}`);
  }
  const probed = new URL(url);
  const child = spawn(startCmd, {
    cwd,
    shell: true,
    stdio: "ignore",
    env: {
      ...process.env,
      PORT: probed.port || (probed.protocol === "https:" ? "443" : "80"),
      HOST: probed.hostname,
    },
    detached: process.platform !== "win32",
  });

  let exited = false;
  child.on("exit", () => {
    exited = true;
  });

  tasks.server?.step(`waiting for ${url}…`);
  const ready = await waitForUrl(url, server.readyTimeoutMs, signal);
  if (!ready) {
    tasks.server?.fail();
    await killTree(child);
    throw new Error(
      signal?.aborted
        ? "Aborted."
        : exited
          ? `Server command exited before ${url} became reachable.`
          : `Server did not become reachable at ${url} within ${server.readyTimeoutMs}ms.`,
    );
  }
  tasks.server?.step(`ready at ${url}`);
  tasks.server?.ok();
  if (!live) logger.success(`Server ready at ${url}`);

  return {
    pid: child.pid,
    stop: async () => {
      logger.info("Shutting down server…");
      await killTree(child);
    },
  };
}
