import { NextResponse } from "next/server";
import { getSeoVisualAsset } from "@/lib/seo/authority";

export const runtime = "nodejs";
export const revalidate = 86400;

type Props = {
  params: Promise<{ assetSlug: string }>;
};

const palette = {
  blue: { bg: "#0f172a", accent: "#2563eb", soft: "#dbeafe", line: "#38bdf8" },
  red: { bg: "#1f0b12", accent: "#dc2626", soft: "#fee2e2", line: "#fb7185" },
  green: { bg: "#052e1a", accent: "#059669", soft: "#dcfce7", line: "#34d399" },
  slate: { bg: "#111827", accent: "#475569", soft: "#e2e8f0", line: "#94a3b8" },
  amber: { bg: "#2b1705", accent: "#d97706", soft: "#fef3c7", line: "#fbbf24" },
} as const;

export async function GET(_request: Request, { params }: Props) {
  const { assetSlug } = await params;
  const asset = getSeoVisualAsset(assetSlug);
  if (!asset) {
    return new NextResponse("Not found", { status: 404 });
  }

  const colors = palette[asset.palette];
  const svg = buildSvg({
    title: asset.title,
    caption: asset.caption,
    kind: asset.kind,
    primaryLabel: asset.primaryLabel,
    secondaryLabel: asset.secondaryLabel,
    colors,
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

function buildSvg({
  title,
  caption,
  kind,
  primaryLabel,
  secondaryLabel,
  colors,
}: {
  title: string;
  caption: string;
  kind: string;
  primaryLabel: string;
  secondaryLabel: string;
  colors: (typeof palette)[keyof typeof palette];
}) {
  const safeTitle = escapeXml(title);
  const safeCaption = escapeXml(caption);
  const safePrimary = escapeXml(primaryLabel);
  const safeSecondary = escapeXml(secondaryLabel);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900" role="img" aria-labelledby="title desc">
  <title id="title">${safeTitle}</title>
  <desc id="desc">${safeCaption}</desc>
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${colors.bg}"/>
      <stop offset="58%" stop-color="#0b1220"/>
      <stop offset="100%" stop-color="${colors.accent}"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="18%" r="70%">
      <stop offset="0%" stop-color="${colors.line}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${colors.line}" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="28" stdDeviation="28" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="1400" height="900" rx="48" fill="url(#bg)"/>
  <rect width="1400" height="900" rx="48" fill="url(#glow)"/>
  <g opacity="0.18">
    <path d="M0 170H1400M0 330H1400M0 490H1400M0 650H1400M0 810H1400" stroke="#ffffff" stroke-width="2"/>
    <path d="M170 0V900M350 0V900M530 0V900M710 0V900M890 0V900M1070 0V900M1250 0V900" stroke="#ffffff" stroke-width="2"/>
  </g>
  <g transform="translate(92 82)">
    <text x="0" y="0" fill="${colors.soft}" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" letter-spacing="6">${safePrimary}</text>
    <text x="0" y="72" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="70" font-weight="900">${safeSecondary}</text>
    <text x="0" y="126" fill="#cbd5e1" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="600">${escapeXml(labelForKind(kind))}</text>
  </g>
  ${kind === "political_mail" ? politicalMail(colors) : kind === "dashboard" ? dashboard(colors) : kind === "postcard_mockup" ? postcard(colors) : kind === "proposal" ? proposal(colors) : coverageMap(colors)}
  <g transform="translate(90 794)">
    <rect width="1220" height="58" rx="20" fill="#ffffff" opacity="0.10"/>
    <text x="28" y="38" fill="#f8fafc" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800">${safeCaption.slice(0, 130)}</text>
  </g>
</svg>`;
}

function coverageMap(colors: (typeof palette)[keyof typeof palette]) {
  return `<g transform="translate(140 265)" filter="url(#shadow)">
    <rect width="1120" height="430" rx="34" fill="#ffffff" opacity="0.94"/>
    <rect x="34" y="34" width="1052" height="362" rx="26" fill="#f8fafc"/>
    <path d="M94 286C180 170 270 310 382 198C492 90 580 214 694 132C812 48 922 154 1030 82" fill="none" stroke="${colors.line}" stroke-width="18" stroke-linecap="round"/>
    <path d="M120 122C230 64 318 98 392 160C510 262 646 296 818 218C910 176 982 172 1040 204" fill="none" stroke="${colors.accent}" stroke-width="10" stroke-linecap="round" stroke-dasharray="28 24"/>
    ${mapPoint(214, 154, "2.8k", colors.accent)}
    ${mapPoint(500, 226, "6.4k", colors.accent)}
    ${mapPoint(826, 138, "9.2k", colors.accent)}
    <rect x="820" y="274" width="214" height="72" rx="18" fill="#0f172a"/>
    <text x="846" y="318" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="900">Route coverage</text>
  </g>`;
}

function postcard(colors: (typeof palette)[keyof typeof palette]) {
  return `<g transform="translate(180 250)" filter="url(#shadow)">
    <rect x="0" y="0" width="520" height="372" rx="30" fill="#ffffff"/>
    <rect x="38" y="40" width="444" height="292" rx="20" fill="${colors.soft}"/>
    <rect x="70" y="72" width="170" height="26" rx="13" fill="${colors.accent}"/>
    <rect x="70" y="130" width="330" height="34" rx="10" fill="#0f172a"/>
    <rect x="70" y="184" width="220" height="18" rx="9" fill="#64748b"/>
    <rect x="70" y="218" width="290" height="18" rx="9" fill="#94a3b8"/>
    <rect x="70" y="266" width="144" height="44" rx="14" fill="${colors.accent}"/>
    <rect x="620" y="0" width="520" height="372" rx="30" fill="#ffffff"/>
    <rect x="660" y="44" width="210" height="22" rx="11" fill="#cbd5e1"/>
    <rect x="660" y="100" width="260" height="150" rx="18" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4"/>
    <rect x="966" y="64" width="128" height="74" rx="12" fill="${colors.soft}" stroke="${colors.accent}" stroke-width="5"/>
    <path d="M662 300H1080" stroke="#cbd5e1" stroke-width="4"/>
    <text x="684" y="338" fill="#334155" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="900">USPS-ready back</text>
  </g>`;
}

function politicalMail(colors: (typeof palette)[keyof typeof palette]) {
  return `<g transform="translate(150 244)" filter="url(#shadow)">
    <rect width="1100" height="420" rx="34" fill="#ffffff"/>
    <rect x="38" y="38" width="494" height="344" rx="24" fill="#111827"/>
    <rect x="76" y="78" width="220" height="26" rx="13" fill="${colors.line}"/>
    <text x="76" y="176" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="58" font-weight="900">READY TO</text>
    <text x="76" y="238" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="58" font-weight="900">LEAD</text>
    <rect x="76" y="286" width="170" height="42" rx="14" fill="${colors.accent}"/>
    <rect x="568" y="38" width="494" height="344" rx="24" fill="#f8fafc"/>
    <path d="M618 108H990M618 164H1000M618 220H930" stroke="#64748b" stroke-width="16" stroke-linecap="round"/>
    <rect x="622" y="274" width="220" height="62" rx="18" fill="#111827"/>
    <rect x="908" y="272" width="106" height="64" rx="14" fill="#fee2e2" stroke="${colors.accent}" stroke-width="5"/>
  </g>`;
}

function dashboard(colors: (typeof palette)[keyof typeof palette]) {
  return `<g transform="translate(170 244)" filter="url(#shadow)">
    <rect width="1060" height="430" rx="34" fill="#ffffff" opacity="0.96"/>
    <rect x="36" y="36" width="988" height="78" rx="22" fill="#0f172a"/>
    <circle cx="82" cy="75" r="14" fill="${colors.line}"/>
    <rect x="120" y="63" width="286" height="24" rx="12" fill="#e2e8f0" opacity="0.35"/>
    <rect x="46" y="152" width="286" height="210" rx="24" fill="${colors.soft}"/>
    <rect x="386" y="152" width="286" height="210" rx="24" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4"/>
    <rect x="726" y="152" width="286" height="210" rx="24" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4"/>
    <path d="M82 302L154 242L220 270L292 204" fill="none" stroke="${colors.accent}" stroke-width="12" stroke-linecap="round"/>
    <rect x="424" y="198" width="190" height="20" rx="10" fill="#64748b"/>
    <rect x="424" y="246" width="142" height="20" rx="10" fill="#94a3b8"/>
    <rect x="764" y="198" width="166" height="20" rx="10" fill="#64748b"/>
    <rect x="764" y="246" width="210" height="20" rx="10" fill="#94a3b8"/>
  </g>`;
}

function proposal(colors: (typeof palette)[keyof typeof palette]) {
  return `<g transform="translate(190 236)" filter="url(#shadow)">
    <rect width="1020" height="452" rx="34" fill="#ffffff"/>
    <rect x="54" y="54" width="380" height="344" rx="26" fill="${colors.soft}"/>
    <rect x="96" y="100" width="220" height="28" rx="14" fill="${colors.accent}"/>
    <rect x="96" y="166" width="280" height="28" rx="14" fill="#0f172a"/>
    <rect x="96" y="222" width="230" height="18" rx="9" fill="#64748b"/>
    <rect x="96" y="262" width="280" height="18" rx="9" fill="#94a3b8"/>
    <rect x="514" y="62" width="420" height="74" rx="20" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4"/>
    <rect x="514" y="174" width="420" height="74" rx="20" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4"/>
    <rect x="514" y="286" width="420" height="74" rx="20" fill="#0f172a"/>
    <text x="548" y="333" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="900">Proposal-ready CTA</text>
  </g>`;
}

function mapPoint(x: number, y: number, label: string, accent: string) {
  return `<g transform="translate(${x} ${y})">
    <circle r="24" fill="${accent}" opacity="0.18"/>
    <circle r="11" fill="${accent}"/>
    <rect x="22" y="-18" width="78" height="36" rx="18" fill="#0f172a"/>
    <text x="42" y="6" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="19" font-weight="900">${label}</text>
  </g>`;
}

function labelForKind(kind: string) {
  switch (kind) {
    case "political_mail":
      return "Political postcard mockup and rollout visual";
    case "dashboard":
      return "Operational dashboard and savings proof visual";
    case "postcard_mockup":
      return "Premium front/back postcard mockup";
    case "proposal":
      return "Proposal package and conversion visual";
    default:
      return "Coverage map and route planning visual";
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
