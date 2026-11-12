import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "ShopMart — Online Store",
  description: "A full-stack ecommerce demo: electronics, clothing, home & more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          <main className="mx-auto max-w-7xl px-4">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
