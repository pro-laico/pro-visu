import path from "node:path";
import http from "node:http";
import https from "node:https";
import { spawn, type ChildProcess } from "node:child_process";
import type { ResolvedServerSettings } from "@/config/schema";
import type { Logger } from "@/utils/logger";

/** A started server we own and must tear down (null when we reused an existing one). */
export interface ServerHandle {
  stop: () => Promise<void>;
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

async function waitForUrl(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe(url)) return true;
    await delay(500);
  }
  return false;
}

/** Run a one-shot command (e.g. a build) to completion, rejecting on non-zero exit. */
function runOnce(command: string, cwd: string, logger: Logger): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`"${command}" failed (exit ${code}).`)),
    );
  });
}

/** Kill a process and its whole tree, cross-platform. */
function killTree(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.pid == null || child.exitCode != null) return resolve();
    if (process.platform === "win32") {
      // The shell-spawned server has child processes (next → node); /T kills the tree.
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      killer.on("error", () => resolve());
      killer.on("close", () => resolve());
    } else {
      try {
        process.kill(-child.pid, "SIGTERM"); // negative pid = the process group
      } catch {
        try {
          child.kill("SIGTERM");
        } catch {
          /* already gone */
        }
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
): Promise<ServerHandle | null> {
  const cwd = server.cwd ? path.resolve(baseCwd, server.cwd) : baseCwd;
  const url = resolveServerUrl(server);

  if (server.reuseExisting && (await probe(url))) {
    logger.info(`Reusing the server already running at ${url}`);
    return null;
  }

  if (server.build) {
    logger.info(`Building: ${server.build}`);
    await runOnce(server.build, cwd, logger);
  }

  logger.info(`Starting server: ${server.command}`);
  const child = spawn(server.command, {
    cwd,
    shell: true,
    stdio: "ignore",
    // POSIX: own process group so we can signal the whole tree. Windows uses taskkill /T.
    detached: process.platform !== "win32",
  });

  let exited = false;
  child.on("exit", () => {
    exited = true;
  });

  const ready = await waitForUrl(url, server.readyTimeoutMs);
  if (!ready) {
    await killTree(child);
    throw new Error(
      exited
        ? `Server command exited before ${url} became reachable.`
        : `Server did not become reachable at ${url} within ${server.readyTimeoutMs}ms.`,
    );
  }
  logger.success(`Server ready at ${url}`);

  return {
    stop: async () => {
      logger.info("Shutting down server…");
      await killTree(child);
    },
  };
}
