import { describe, expect, it } from "vitest";
import { mapLimit, Semaphore } from "@/utils/concurrency";

describe("Semaphore", () => {
  it("grants up to `permits` immediately, then queues", () => {
    const sem = new Semaphore(2);
    expect(sem.tryAcquire()).toBe(true);
    expect(sem.tryAcquire()).toBe(true);
    expect(sem.tryAcquire()).toBe(false);
    sem.release();
    expect(sem.tryAcquire()).toBe(true);
  });

  it("hands a released permit to the oldest waiter (FIFO)", async () => {
    const sem = new Semaphore(1);
    await sem.acquire();
    const order: number[] = [];
    const a = sem.acquire().then(() => order.push(1));
    const b = sem.acquire().then(() => order.push(2));
    sem.release();
    await a;
    sem.release();
    await b;
    expect(order).toEqual([1, 2]);
    // Both waiters consumed handed-off permits; the one release-after still leaves capacity 1.
    sem.release();
    expect(sem.tryAcquire()).toBe(true);
    expect(sem.tryAcquire()).toBe(false);
  });

  it("clamps a nonsensical permit count to 1", () => {
    const sem = new Semaphore(0);
    expect(sem.tryAcquire()).toBe(true);
    expect(sem.tryAcquire()).toBe(false);
  });

  it("caps concurrent holders under load", async () => {
    const sem = new Semaphore(3);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 20 }, async () => {
        await sem.acquire();
        try {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((r) => setTimeout(r, 1));
        } finally {
          active -= 1;
          sem.release();
        }
      }),
    );
    expect(peak).toBeLessThanOrEqual(3);
  });
});

describe("mapLimit", () => {
  it("preserves input order and respects the limit", async () => {
    let active = 0;
    let peak = 0;
    const result = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 1));
      active -= 1;
      return n * 10;
    });
    expect(result).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
