import { describe, expect, it } from "vitest";
import { shouldReexec } from "@/cli/reexec";

describe("shouldReexec", () => {
  it("re-execs only for a higher target that we haven't already applied", () => {
    expect(shouldReexec(undefined, 4096, false)).toBe(false); // no target set
    expect(shouldReexec(0, 4096, false)).toBe(false); // non-positive target
    expect(shouldReexec(8192, 4096, false)).toBe(true); // want more heap than we have
    expect(shouldReexec(8192, 4096, true)).toBe(false); // already re-exec'd — don't loop
    expect(shouldReexec(2048, 4096, false)).toBe(false); // target below current — no point
  });

  it("ignores a target within ~5% of the current limit", () => {
    expect(shouldReexec(4096, 4096, false)).toBe(false); // already enough
    expect(shouldReexec(4096, 3800, false)).toBe(true); // current is meaningfully lower
  });
});
