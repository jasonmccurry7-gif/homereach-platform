import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { JsonLd } from "@/components/seo/JsonLd";
import { SeoAttributionBeacon } from "@/components/seo/SeoAttributionBeacon";
import { validateEnv } from "@/lib/env";
import { buildOrganizationLd, buildSiteNavigationLd, buildWebsiteLd } from "@/lib/seo/schema";
import "./globals.css";

if (process.env.NODE_ENV === "production") {
  validateEnv();
}

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "HomeReach - AI-Powered Local Growth OS",
    template: "%s | HomeReach",
  },
  description:
    "HomeReach helps local businesses and campaigns get found, capture leads, improve reputation, create content, protect margin, and execute campaigns through one AI-powered local growth operating system.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com"
  ),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
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
    title: "HomeReach - AI-Powered Local Growth and Execution",
    description:
      "HomeReach helps local businesses and campaigns stay visible, generate leads, protect margin, and execute direct mail, local SEO, procurement, reputation, and follow-up workflows.",
    url: "/",
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "HomeReach",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HomeReach - AI-Powered Local Growth and Execution",
    description:
      "Local growth, campaign mail, purchasing intelligence, SEO, reputation, and follow-up execution under one simple HomeReach ecosystem.",
    images: ["/icons/icon-512.png"],
  },
};

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com";
const siteNavigation = [
  { name: "AI Growth OS", url: `${baseUrl}/local-growth-os` },
  { name: "Shared Campaigns", url: `${baseUrl}/shared-postcards` },
  { name: "Targeted Campaigns", url: `${baseUrl}/targeted` },
  { name: "Political Mail", url: `${baseUrl}/political-mail` },
  { name: "Procurement Intelligence", url: `${baseUrl}/inventory-purchasing` },
  { name: "Local Visibility", url: `${baseUrl}/local-visibility` },
  { name: "AI Web Assistant", url: `${baseUrl}/services/ai-website-assistant` },
  { name: "Local SEO", url: `${baseUrl}/services/local-seo` },
  { name: "Government Contracts", url: `${baseUrl}/services/government-contracts` },
  { name: "ContractOS", url: `${baseUrl}/contractos` },
  { name: "Ohio Authority", url: `${baseUrl}/ohio` },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white font-sans antialiased">
        <JsonLd schemas={[buildOrganizationLd(), buildWebsiteLd(), buildSiteNavigationLd(siteNavigation)]} />
        <SeoAttributionBeacon />
        {children}
      </body>
    </html>
  );
}
