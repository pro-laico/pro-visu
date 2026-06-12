import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Built once at tool-build time into ../dist/scene-app and shipped statically. At generate
// time the CLI just serves these files — no Vite at runtime. `base: "./"` keeps asset URLs
// relative so it works served from any origin/port.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("../dist/scene-app", import.meta.url)),
    emptyOutDir: true,
    // Single-file-ish output is easier to serve; inline small assets.
    assetsInlineLimit: 100_000,
  },
});
