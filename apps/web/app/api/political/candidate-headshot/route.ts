import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HEADSHOT_HOSTS = new Set([
  "upload.wikimedia.org",
  "www.ohiohouse.gov",
  "ohiohouse.gov",
  "ohiosenate.gov",
  "www.ohiosenate.gov",
  "ohioauditor.gov",
  "www.ohioauditor.gov",
  "ohiodems.org",
  "www.ohiodems.org",
  "ohiogop.org",
  "www.ohiogop.org",
]);

const IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function fallbackSvg(name: string) {
  const label = name.trim() || "Candidate";
  const initials =
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "HR";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640" role="img" aria-label="${escapeXml(label)} headshot pending">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0B1F3A"/>
      <stop offset="55%" stop-color="#163B65"/>
      <stop offset="100%" stop-color="#B22234"/>
    </linearGradient>
    <radialGradient id="shine" cx="35%" cy="20%" r="75%">
      <stop offset="0%" stop-color="#F5F7FA" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#F5F7FA" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="640" fill="url(#bg)"/>
  <rect width="640" height="640" fill="url(#shine)"/>
  <circle cx="320" cy="245" r="92" fill="#F5F7FA" fill-opacity="0.92"/>
  <path d="M145 575c22-112 91-174 175-174s153 62 175 174" fill="#F5F7FA" fill-opacity="0.92"/>
  <circle cx="492" cy="112" r="46" fill="#D4AF37" fill-opacity="0.82"/>
  <text x="320" y="592" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="900" fill="#F5F7FA">${escapeXml(initials)}</text>
</svg>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fallbackResponse(name: string) {
  return new NextResponse(fallbackSvg(name), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "X-HomeReach-Headshot": "fallback",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const source = url.searchParams.get("src");
  const name = url.searchParams.get("name") ?? "Candidate";
  if (!source) return fallbackResponse(name);

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
  } catch {
    return fallbackResponse(name);
  }

  if (sourceUrl.protocol !== "https:" || !ALLOWED_HEADSHOT_HOSTS.has(sourceUrl.hostname.toLowerCase())) {
    return fallbackResponse(name);
  }

  try {
    const upstream = await fetch(sourceUrl.toString(), {
      redirect: "follow",
      headers: {
        "User-Agent": "HomeReachPoliticalHeadshotProxy/1.0 (+https://home-reach.com/political/data-sources)",
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.5",
      },
      next: { revalidate: 60 * 60 * 24 },
    });

    const contentType = upstream.headers.get("content-type")?.split(";")[0]?.toLowerCase() ?? "";
    if (!upstream.ok || !IMAGE_CONTENT_TYPES.has(contentType)) {
      return fallbackResponse(name);
    }

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-HomeReach-Headshot": "proxied",
      },
    });
  } catch {
    return fallbackResponse(name);
  }
}
