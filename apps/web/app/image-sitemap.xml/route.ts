import { listAuthorityGuides, listOhioAuthorityPages, listSeoVisualAssets } from "@/lib/seo/authority";

export const runtime = "nodejs";
export const revalidate = 86400;

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

export function GET() {
  const pageAssets = new Map<string, { title: string; caption: string; image: string }>();

  pageAssets.set("/ohio", {
    title: "Ohio direct mail authority map",
    caption: "HomeReach Ohio authority hub for direct mail and campaign execution.",
    image: "/seo-assets/ohio-authority-direct-mail-map.svg",
  });

  for (const page of listOhioAuthorityPages()) {
    pageAssets.set(page.path, {
      title: page.visual.title,
      caption: page.visual.caption,
      image: `/seo-assets/${page.visual.assetSlug}.svg`,
    });
  }

  for (const guide of listAuthorityGuides()) {
    pageAssets.set(`/learn/${guide.slug}`, {
      title: guide.visual.title,
      caption: guide.visual.caption,
      image: `/seo-assets/${guide.visual.assetSlug}.svg`,
    });
  }

  const knownAssets = new Set(listSeoVisualAssets().map((asset) => `/seo-assets/${asset.assetSlug}.svg`));
  const entries = Array.from(pageAssets.entries()).filter(([, asset]) => knownAssets.has(asset.image));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries
  .map(
    ([path, asset]) => `  <url>
    <loc>${escapeXml(`${BASE}${path}`)}</loc>
    <image:image>
      <image:loc>${escapeXml(`${BASE}${asset.image}`)}</image:loc>
      <image:title>${escapeXml(asset.title)}</image:title>
      <image:caption>${escapeXml(asset.caption)}</image:caption>
    </image:image>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
