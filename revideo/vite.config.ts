import { defineConfig } from "vite";
import revideo from "@revideo/vite-plugin";

// Vite project built by @revideo/renderer at runtime to composite the device frame.
// Shipped as source (see package.json "files") — not transpiled by tsup.
export default defineConfig({
  // The device-frame generator drops the captured video here and serves it at "/".
  publicDir: process.env.REVIDEO_PUBLIC_DIR || "public",
  plugins: [revideo()],
  // Pre-bundle Revideo's runtime deps at server start. Without this, Vite discovers them
  // on the first transform, re-optimizes, and reloads the page mid-render — which throws
  // "The scene is not available in the current context".
  optimizeDeps: {
    include: ["@revideo/core", "@revideo/2d", "@revideo/2d/lib/jsx-dev-runtime"],
  },
});
