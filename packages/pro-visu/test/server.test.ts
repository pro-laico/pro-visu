import { describe, expect, it } from "vitest";
import { settingsSchema, serverSettingsSchema } from "@/config/schema";
import { resolveServerUrl } from "@/server/manage-server";

describe("server settings", () => {
  it("derives the readiness URL from a port", () => {
    const server = serverSettingsSchema.parse({ command: "next start", port: 3000 });
    expect(resolveServerUrl(server)).toBe("http://127.0.0.1:3000");
  });

  it("prefers an explicit url over the port", () => {
    const server = serverSettingsSchema.parse({
      command: "next start",
      port: 3000,
      url: "http://localhost:4321",
    });
    expect(resolveServerUrl(server)).toBe("http://localhost:4321");
  });

  it("defaults the port (and thus the readiness url) to 3101 when neither is set", () => {
    const server = serverSettingsSchema.parse({ command: "next start" });
    expect(server.port).toBe(3101);
    expect(resolveServerUrl(server)).toBe("http://127.0.0.1:3101");
  });

  it("defaults reuseExisting on and applies a readiness timeout", () => {
    const server = serverSettingsSchema.parse({ command: "next start", port: 3000 });
    expect(server.reuseExisting).toBe(true);
    expect(server.readyTimeoutMs).toBe(120_000);
  });

  it("is optional in settings (no server block)", () => {
    expect(settingsSchema.parse({}).server).toBeUndefined();
  });

  it("accepts an empty server block — command/build default to the project's scripts at runtime", () => {
    const server = serverSettingsSchema.parse({});
    expect(server.command).toBeUndefined();
    expect(server.build).toBeUndefined();
    expect(server.port).toBe(3101); // other defaults still apply
  });

  it("accepts build: false to skip the build step", () => {
    expect(serverSettingsSchema.parse({ build: false }).build).toBe(false);
    // an empty-string build is still rejected (min length) — false is the disable sentinel
    expect(() => serverSettingsSchema.parse({ build: "" })).toThrow();
  });
});
