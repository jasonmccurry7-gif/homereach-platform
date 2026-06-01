import { listSeoVisualAssets } from "@/lib/seo/authority";

export const runtime = "nodejs";
export const revalidate = 86400;

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";

export function GET() {
  const pageAssets = new Map<string, Array<{ title: string; caption: string; image: string }>>();

  for (const asset of listSeoVisualAssets()) {
    const existing = pageAssets.get(asset.path) ?? [];
    existing.push({
      title: asset.title,
      caption: asset.caption,
      image: `/seo-assets/${asset.assetSlug}.svg`,
    });
    pageAssets.set(asset.path, existing);
  }

  const knownAssets = new Set(listSeoVisualAssets().map((asset) => `/seo-assets/${asset.assetSlug}.svg`));
  const entries = Array.from(pageAssets.entries())
    .map(([path, assets]) => [path, assets.filter((asset) => knownAssets.has(asset.image))] as const)
    .filter(([, assets]) => assets.length > 0);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries
  .map(
    ([path, assets]) => `  <url>
    <loc>${escapeXml(`${BASE}${path}`)}</loc>
${assets
  .map(
    (asset) => `    <image:image>
      <image:loc>${escapeXml(`${BASE}${asset.image}`)}</image:loc>
      <image:title>${escapeXml(asset.title)}</image:title>
      <image:caption>${escapeXml(asset.caption)}</image:caption>
    </image:image>`,
  )
  .join("\n")}
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
