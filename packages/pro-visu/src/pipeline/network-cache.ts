import type { Page, Route } from "playwright-core";
import type { Logger } from "@/utils/logger";

/**
 * A per-capture, cross-worker response cache. Parallel frame-capture workers each run an ISOLATED
 * browser context, so without this every worker re-downloads the whole site — N workers means N
 * full page loads hammering the (often local dev) server and N copies of every image decoded off
 * the network. Install on each worker's page: the first request for a URL fetches it once; every
 * other worker replays the recorded response. Determinism is a feature here — frame-stepped
 * captures WANT byte-identical responses in every worker.
 *
 * Deliberately conservative about what it touches:
 *   - Only GET, and never requests carrying a `Range` header (Chromium's media stack) or
 *     `eventsource` streams — those fall back to the network untouched.
 *   - Only 200 responses within the size budgets are recorded; anything else falls back.
 *   - Any interception error falls back to a normal network fetch (fail-open).
 */

interface CacheEntry {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

/** Per-response cap: don't buffer big media in Node (the memory budget belongs to captures). */
const DEFAULT_MAX_ENTRY_BYTES = 8 * 1024 * 1024;
/** Whole-cache cap per capture; once full, later responses simply aren't recorded. */
const DEFAULT_MAX_TOTAL_BYTES = 256 * 1024 * 1024;

/**
 * Headers describing the ORIGINAL transfer's wire encoding. `route.fetch()` hands us the decoded
 * body, so replaying these (e.g. `content-encoding: gzip` over an already-decoded body) would
 * corrupt the replayed response.
 */
const STRIP_HEADERS = new Set(["content-encoding", "content-length", "transfer-encoding", "connection"]);

export interface SharedNetworkCache {
  /** Register the record/replay route on a worker's page (call BEFORE navigation). */
  install(page: Page): Promise<void>;
}

export interface SharedNetworkCacheArgs {
  logger: Logger;
  maxEntryBytes?: number;
  maxTotalBytes?: number;
}

export function createSharedNetworkCache(args: SharedNetworkCacheArgs): SharedNetworkCache {
  const maxEntryBytes = args.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES;
  const maxTotalBytes = args.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  const entries = new Map<string, CacheEntry>();
  /** In-flight single-flight: losers await the winner's fetch instead of racing the network. */
  const inflight = new Map<string, Promise<CacheEntry | null>>();
  let totalBytes = 0;
  let budgetWarned = false;

  const handler = async (route: Route): Promise<void> => {
    const request = route.request();
    const url = request.url();
    if (
      request.method() !== "GET" ||
      request.headers().range != null ||
      request.resourceType() === "eventsource"
    ) {
      return route.fallback();
    }

    const hit = entries.get(url);
    if (hit) return route.fulfill({ status: hit.status, headers: hit.headers, body: hit.body });

    const pending = inflight.get(url);
    if (pending) {
      const entry = await pending;
      if (entry) return route.fulfill({ status: entry.status, headers: entry.headers, body: entry.body });
      return route.fallback(); // the winner's response wasn't cacheable — fetch normally
    }

    // Winner: fetch once, record if cacheable, and fulfill THIS route from the same response.
    let resolveEntry!: (entry: CacheEntry | null) => void;
    inflight.set(url, new Promise<CacheEntry | null>((resolve) => (resolveEntry = resolve)));
    let entry: CacheEntry | null = null;
    try {
      const response = await route.fetch();
      const body = await response.body();
      if (response.status() === 200 && body.length <= maxEntryBytes) {
        if (totalBytes + body.length <= maxTotalBytes) {
          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(response.headers())) {
            if (!STRIP_HEADERS.has(key.toLowerCase())) headers[key] = value;
          }
          entry = { status: 200, headers, body };
          entries.set(url, entry);
          totalBytes += body.length;
        } else if (!budgetWarned) {
          budgetWarned = true;
          args.logger.debug(
            `shared network cache full (${Math.round(maxTotalBytes / 1024 / 1024)}MB) — later responses fetch per worker`,
          );
        }
      }
      await route.fulfill({ response, body });
    } catch {
      // Fetch or fulfill failed (server hiccup, page tearing down) — fail open to a plain fetch.
      try {
        await route.fallback();
      } catch {
        /* route already handled / page gone */
      }
    } finally {
      resolveEntry(entry);
      inflight.delete(url); // future requests hit `entries` (or refetch if it wasn't cacheable)
    }
  };

  return {
    install: async (page) => {
      await page.route("**/*", handler);
    },
  };
}
