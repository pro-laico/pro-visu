import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8"),
) as { version: string };

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "cli/index": "src/cli/index.ts",
  },
  format: ["esm"],
  target: "node18",
  platform: "node",
  dts: true,
  // Don't wipe dist here: tsup's `clean` removes the WHOLE outDir, which would delete the scene-app
  // bundle (dist/scene-app, built by the separate `build:scene` Vite step) on a partial `build:cli`.
  // The full `build` script cleans dist once up front instead; tsup just overwrites its own outputs.
  clean: false,
  splitting: false,
  sourcemap: true,
  // Inline the package version so the CLI doesn't read package.json at runtime.
  define: { __TOOL_VERSION__: JSON.stringify(pkg.version) },
  // Runtime deps (playwright-core, c12, etc.) stay external automatically
  // because they're in package.json `dependencies`. We only transpile our own `src`.
  // The `@/` alias resolves via tsconfig `paths` (esbuild reads it when bundling).
});
