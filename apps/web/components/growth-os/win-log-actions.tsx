"use client";

import { useState } from "react";
import { Copy, ImageDown } from "lucide-react";
import { formatCurrencyCents } from "@/lib/growth-os/metrics";

export function WinLogActions({
  winId,
  title,
  impactCents,
}: {
  winId: string;
  title: string;
  impactCents: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}#win-${winId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function exportImage() {
    const impact = formatCurrencyCents(impactCents);
    const svg = buildWinSvg(title, impact);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `growth-os-win-${winId}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
      >
        <Copy className="h-4 w-4" aria-hidden="true" />
        {copied ? "Copied" : "Copy link"}
      </button>
      <button
        type="button"
        onClick={exportImage}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
      >
        <ImageDown className="h-4 w-4" aria-hidden="true" />
        Export image
      </button>
    </div>
  );
}

function buildWinSvg(title: string, impact: string) {
  const safeTitle = escapeXml(title);
  const safeImpact = escapeXml(impact);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f8fafc"/>
  <rect x="80" y="80" width="1040" height="470" rx="18" fill="#ffffff" stroke="#dbeafe" stroke-width="4"/>
  <text x="120" y="165" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#1d4ed8">Food Service Growth OS Win</text>
  <text x="120" y="265" font-family="Arial, sans-serif" font-size="52" font-weight="800" fill="#111827">${safeImpact}/mo</text>
  <text x="120" y="345" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#111827">${safeTitle}</text>
  <text x="120" y="430" font-family="Arial, sans-serif" font-size="24" fill="#4b5563">Estimated impact based on directional comparison.</text>
</svg>`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
