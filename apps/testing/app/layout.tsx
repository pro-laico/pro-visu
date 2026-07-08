import "./globals.css";
import type { ReactNode } from "react";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { CartProvider } from "@/app/components/cart";
import { Header } from "@/app/components/Header";
import { Footer } from "@/app/components/Footer";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "FASHION — Considered tailoring, quietly made",
  description:
    "Maison Fashion. Ready-to-wear outerwear, knitwear and tailoring, made in Europe. A sample storefront used to generate and validate pro-visu assets.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <CartProvider>
          <Header />
          {children}
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
