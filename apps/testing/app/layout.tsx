import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "auto-showcase testing target",
  description: "A sample site used to generate and validate showcase assets.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
