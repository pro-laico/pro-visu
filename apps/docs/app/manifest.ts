import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. Icons live in public/seo (added alongside the favicon set).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "pro-visu",
    short_name: "pro-visu",
    description:
      "A portable CLI that turns the websites you build into marketing assets — scroll reels, responsive screenshots, media walls, and type/colour specimens.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0055ff",
    icons: [
      { src: "/seo/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/seo/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/seo/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
