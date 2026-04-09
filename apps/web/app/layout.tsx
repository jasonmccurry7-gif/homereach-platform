import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { validateEnv } from "@/lib/env";

// Validate all required environment variables at startup.
// Throws immediately with a clear message if anything critical is missing.
// Must run server-side before any route is served.
validateEnv();

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "HomeReach — Local Marketing That Works",
    template: "%s | HomeReach",
  },
  description:
    "HomeReach connects local businesses with their community through targeted postcard campaigns, digital outreach, and smart automation.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com"
  ),
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
