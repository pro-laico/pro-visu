import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import UnoCSS from "unocss/vite";
import { presetAttributify, presetWind3 } from "unocss";

// Built once at tool-build time into ../dist/scene-app and shipped statically. At generate
// time the CLI just serves these files — no Vite at runtime. `base: "./"` keeps asset URLs
// relative so it works served from any origin/port.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [
    // UnoCSS (Tailwind preset + attributify). Color tokens map to CSS custom properties so a
    // scene can re-theme at runtime (the specimen sets `--sp-*` from config). The token utilities
    // are applied with dynamic values, so they're safelisted to guarantee they reach the build.
    UnoCSS({
      presets: [presetWind3({ preflight: false }), presetAttributify()],
      theme: {
        colors: {
          foreground: "var(--sp-foreground)",
          muted: "var(--sp-muted)",
          accent: "var(--sp-accent)",
        },
      },
      safelist: ["text-foreground", "text-muted", "text-accent"],
    }),
    react(),
  ],
  build: {
    outDir: fileURLToPath(new URL("../dist/scene-app", import.meta.url)),
    emptyOutDir: true,
    // Single-file-ish output is easier to serve; inline small assets.
    assetsInlineLimit: 100_000,
  },
});
