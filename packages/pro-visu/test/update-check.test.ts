import { describe, expect, it } from "vitest";
import { isNewerVersion, updateCheckEnabled } from "@/cli/update-check";

describe("isNewerVersion", () => {
  it("compares x.y.z numerically", () => {
    expect(isNewerVersion("0.5.0", "0.5.1")).toBe(true);
    expect(isNewerVersion("0.5.0", "0.6.0")).toBe(true);
    expect(isNewerVersion("0.5.0", "1.0.0")).toBe(true);
    expect(isNewerVersion("0.5.0", "0.5.0")).toBe(false);
    expect(isNewerVersion("0.5.1", "0.5.0")).toBe(false);
    expect(isNewerVersion("0.10.0", "0.9.0")).toBe(false); // numeric, not lexicographic
  });
});

describe("updateCheckEnabled", () => {
  const cleanEnv = {} as NodeJS.ProcessEnv;

  it("is on for a normal published run", () => {
    expect(updateCheckEnabled(cleanEnv, [], "0.5.0")).toBe(true);
  });

  it("skips the unpublished dev build", () => {
    expect(updateCheckEnabled(cleanEnv, [], "0.0.0-dev")).toBe(false);
  });

  it("honors the opt-outs (env + flag) and CI/test environments", () => {
    expect(updateCheckEnabled({ NO_UPDATE_NOTIFIER: "1" } as NodeJS.ProcessEnv, [], "0.5.0")).toBe(false);
    expect(updateCheckEnabled({ CI: "true" } as NodeJS.ProcessEnv, [], "0.5.0")).toBe(false);
    expect(updateCheckEnabled({ NODE_ENV: "test" } as NodeJS.ProcessEnv, [], "0.5.0")).toBe(false);
    expect(updateCheckEnabled(cleanEnv, ["--no-update-notifier"], "0.5.0")).toBe(false);
  });
});
