import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { validateEnv } from "@/lib/env";
import "./globals.css";

if (process.env.NODE_ENV === "production") {
  validateEnv();
}

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "HomeReach - Geographic Intelligence Platform",
    template: "%s | HomeReach",
  },
  description:
    "HomeReach helps businesses and campaigns dominate local visibility through shared postcards, targeted campaigns, political mail, property intelligence, purchasing intelligence, and supporting print products.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com"
  ),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    siteName: "HomeReach",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
