import { createMDX } from "fumadocs-mdx/next";
import { withNextVideo } from "next-video/process";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
};

// withNextVideo wraps the outermost config: it registers the loader that turns
// `import clip from "/videos/clip.mp4"` into a Mux-backed asset (and serves the
// local source as a fallback until `next-video sync` has processed it).
export default withNextVideo(withMDX(config));
