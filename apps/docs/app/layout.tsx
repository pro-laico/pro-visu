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
