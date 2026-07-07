import { describe, expect, it, vi } from "vitest";
import type { Page, Route } from "playwright-core";
import { createSharedNetworkCache } from "@/recorder/network-cache";
import { createLogger } from "@/utils/logger";

interface FakeResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: Buffer;
}

interface FakeRouteOptions {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  resourceType?: string;
  response?: FakeResponse;
  /** Delay the fetch so in-flight dedupe can be observed. */
  fetchDelayMs?: number;
  fetchError?: Error;
}

function fakeRoute(opts: FakeRouteOptions = {}) {
  const fetchImpl = vi.fn(async () => {
    if (opts.fetchDelayMs) await new Promise((r) => setTimeout(r, opts.fetchDelayMs));
    if (opts.fetchError) throw opts.fetchError;
    const r = opts.response ?? {};
    return {
      status: () => r.status ?? 200,
      headers: () => r.headers ?? { "content-type": "text/html" },
      body: async () => r.body ?? Buffer.from("hello"),
    };
  });
  const fulfill = vi.fn(async (_opts?: unknown) => {});
  const fallback = vi.fn(async () => {});
  const route = {
    request: () => ({
      url: () => opts.url ?? "https://example.com/",
      method: () => opts.method ?? "GET",
      headers: () => opts.headers ?? {},
      resourceType: () => opts.resourceType ?? "document",
    }),
    fetch: fetchImpl,
    fulfill,
    fallback,
  };
  return { route: route as unknown as Route, fetch: fetchImpl, fulfill, fallback };
}

/** Install on a fake page and hand back the registered handler. */
async function installedHandler(cache: ReturnType<typeof createSharedNetworkCache>) {
  let handler!: (route: Route) => Promise<void>;
  const page = { route: async (_glob: string, h: (route: Route) => Promise<void>) => (handler = h) };
  await cache.install(page as unknown as Page);
  return handler;
}

describe("shared network cache", () => {
  it("fetches once and replays the recorded response to later requests", async () => {
    const cache = createSharedNetworkCache({ logger: createLogger("silent") });
    const handler = await installedHandler(cache);

    const first = fakeRoute({ response: { body: Buffer.from("page-bytes") } });
    await handler(first.route);
    expect(first.fetch).toHaveBeenCalledTimes(1);
    expect(first.fulfill).toHaveBeenCalledTimes(1);

    const second = fakeRoute();
    await handler(second.route);
    expect(second.fetch).not.toHaveBeenCalled(); // replayed, no network
    expect(second.fulfill).toHaveBeenCalledWith(
      expect.objectContaining({ status: 200, body: Buffer.from("page-bytes") }),
    );
  });

  it("single-flights concurrent requests for the same URL", async () => {
    const cache = createSharedNetworkCache({ logger: createLogger("silent") });
    const handler = await installedHandler(cache);

    const winner = fakeRoute({ fetchDelayMs: 10 });
    const loser = fakeRoute();
    await Promise.all([handler(winner.route), handler(loser.route)]);
    expect(winner.fetch).toHaveBeenCalledTimes(1);
    expect(loser.fetch).not.toHaveBeenCalled(); // waited for the winner instead of racing
    expect(loser.fulfill).toHaveBeenCalledTimes(1);
  });

  it("strips wire-encoding headers from replayed responses", async () => {
    const cache = createSharedNetworkCache({ logger: createLogger("silent") });
    const handler = await installedHandler(cache);

    await handler(
      fakeRoute({
        response: {
          headers: { "content-type": "text/css", "content-encoding": "gzip", "content-length": "9999" },
        },
      }).route,
    );
    const replay = fakeRoute();
    await handler(replay.route);
    const headers = (replay.fulfill.mock.calls[0]![0] as { headers: Record<string, string> }).headers;
    expect(headers["content-type"]).toBe("text/css");
    expect(headers["content-encoding"]).toBeUndefined();
    expect(headers["content-length"]).toBeUndefined();
  });

  it("passes through non-GET, Range, and eventsource requests", async () => {
    const cache = createSharedNetworkCache({ logger: createLogger("silent") });
    const handler = await installedHandler(cache);

    for (const opts of [
      { method: "POST" },
      { headers: { range: "bytes=0-" } },
      { resourceType: "eventsource" },
    ]) {
      const r = fakeRoute(opts);
      await handler(r.route);
      expect(r.fetch).not.toHaveBeenCalled();
      expect(r.fallback).toHaveBeenCalledTimes(1);
    }
  });

  it("does not record non-200 or oversized responses (later requests refetch)", async () => {
    const cache = createSharedNetworkCache({ logger: createLogger("silent"), maxEntryBytes: 4 });
    const handler = await installedHandler(cache);

    const big = fakeRoute({ url: "https://example.com/big", response: { body: Buffer.from("too-large") } });
    await handler(big.route);
    expect(big.fulfill).toHaveBeenCalledTimes(1); // the winner still gets its bytes

    const retry = fakeRoute({ url: "https://example.com/big" });
    await handler(retry.route);
    expect(retry.fetch).toHaveBeenCalledTimes(1); // not cached — fetched again

    const missing = fakeRoute({ url: "https://example.com/404", response: { status: 404 } });
    await handler(missing.route);
    const after = fakeRoute({ url: "https://example.com/404", response: { status: 404 } });
    await handler(after.route);
    expect(after.fetch).toHaveBeenCalledTimes(1); // 404 never recorded
  });

  it("fails open to a network fetch when the upstream fetch throws", async () => {
    const cache = createSharedNetworkCache({ logger: createLogger("silent") });
    const handler = await installedHandler(cache);

    const broken = fakeRoute({ fetchError: new Error("net::ERR_CONNECTION_REFUSED") });
    await handler(broken.route);
    expect(broken.fallback).toHaveBeenCalledTimes(1);

    // The failure must not poison the URL: the next request fetches fresh.
    const next = fakeRoute();
    await handler(next.route);
    expect(next.fetch).toHaveBeenCalledTimes(1);
    expect(next.fulfill).toHaveBeenCalledTimes(1);
  });
});
