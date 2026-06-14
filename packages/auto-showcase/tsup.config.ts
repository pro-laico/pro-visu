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
  clean: true,
  splitting: false,
  sourcemap: true,
  // Inline the package version so the CLI doesn't read package.json at runtime.
  define: { __TOOL_VERSION__: JSON.stringify(pkg.version) },
  // Runtime deps (playwright-core, ffmpeg-static, c12, etc.) stay external automatically
  // because they're in package.json `dependencies`. We only transpile our own `src`.
  // The `@/` alias resolves via tsconfig `paths` (esbuild reads it when bundling).
});
