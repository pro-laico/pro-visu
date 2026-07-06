import { createMDX } from "fumadocs-mdx/next";
import { withNextVideo } from "next-video/process";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async rewrites() {
    return {
      // beforeFiles so a markdown-negotiated request preempts the HTML page route.
      beforeFiles: [
        // Content negotiation: agents that prefer markdown (Claude Code & others send
        // `Accept: text/markdown`) get the clean version at the SAME url — no .md suffix.
        {
          source: "/docs/:path*",
          has: [{ type: "header", key: "accept", value: "(.*)text/markdown(.*)" }],
          destination: "/llms.mdx/docs/:path*",
        },
        // Explicit fallback: appending `.md` to any docs URL also serves the clean markdown.
        { source: "/docs/:path*.md", destination: "/llms.mdx/docs/:path*" },
      ],
    };
  },
  // Tell caches the docs HTML varies by Accept, so a markdown-preferring agent isn't served cached HTML.
  async headers() {
    return [{ source: "/docs/:path*", headers: [{ key: "Vary", value: "Accept" }] }];
  },
};

// withNextVideo wraps the outermost config: it registers the loader that turns
// `import clip from "/videos/clip.mp4"` into a Mux-backed asset (and serves the
// local source as a fallback until `next-video sync` has processed it).
export default withNextVideo(withMDX(config));
