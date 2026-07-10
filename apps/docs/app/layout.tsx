import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://pro-visu.com"),
  title: {
    default: "pro-visu",
    template: "%s — pro-visu",
  },
  description:
    "A portable CLI that turns the websites you build into marketing assets — scroll reels, responsive screenshots, media walls, and type/colour specimens.",
  icons: {
    icon: [
      { url: "/seo/icon.svg", type: "image/svg+xml" },
      { url: "/seo/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/seo/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/seo/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/seo/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/seo/favicon.ico",
    apple: "/seo/apple-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
