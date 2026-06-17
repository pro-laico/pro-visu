import { beforeEach, describe, expect, it, vi } from "vitest";

const notify = vi.fn();
const updateNotifier = vi.fn(() => ({ notify }));
vi.mock("update-notifier", () => ({ default: updateNotifier }));

const { checkForUpdates } = await import("@/cli/update-check");

describe("checkForUpdates", () => {
  beforeEach(() => {
    updateNotifier.mockClear();
    notify.mockClear();
    updateNotifier.mockImplementation(() => ({ notify }));
  });

  it("skips the unpublished dev build", () => {
    checkForUpdates("0.0.0-dev");
    expect(updateNotifier).not.toHaveBeenCalled();
  });

  it("checks the registry for a real version and defers the notice", () => {
    checkForUpdates("0.2.0");
    expect(updateNotifier).toHaveBeenCalledWith(
      expect.objectContaining({
        pkg: { name: "pro-visu", version: "0.2.0" },
        shouldNotifyInNpmScript: true,
      }),
    );
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ defer: true }));
  });

  it("never throws if the update check itself fails", () => {
    updateNotifier.mockImplementationOnce(() => {
      throw new Error("network down");
    });
    expect(() => checkForUpdates("0.2.0")).not.toThrow();
  });
});
