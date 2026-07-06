/**
 * A plain counting semaphore: at most `permits` holders at a time, FIFO waiters. Used as the
 * run-wide budget for memory-heavy resources (e.g. supersampled render contexts), where per-call
 * limits multiply against pipeline concurrency and blow past what the machine can hold.
 */
export class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(permits: number) {
    this.available = Math.max(1, permits);
  }

  /** Take a permit immediately if one is free (no queueing). */
  tryAcquire(): boolean {
    if (this.available <= 0) return false;
    this.available -= 1;
    return true;
  }

  /** Wait for a permit. Callers MUST pair with release() (use try/finally). */
  async acquire(): Promise<void> {
    if (this.tryAcquire()) return;
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  release(): void {
    const next = this.waiters.shift();
    if (next) next(); // hand the permit straight to the oldest waiter
    else this.available += 1;
  }
}

/**
 * Run `fn` over `items` with at most `limit` in flight, preserving input order in the
 * result. `fn` should not reject — callers handle per-item errors and return a value.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  const worker = async (): Promise<void> => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index] as T, index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
