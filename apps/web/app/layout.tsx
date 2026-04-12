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
  // PWA support — enables "Add to Home Screen" on iOS and Android
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HomeReach OS",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#2563eb",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className="min-h-screen bg-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
