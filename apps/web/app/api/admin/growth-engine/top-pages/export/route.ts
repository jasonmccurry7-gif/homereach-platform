import { NextResponse } from "next/server";
import { topRevenuePages } from "@/lib/growth-engine/blueprint";
import { isGrowthEngineEnabled } from "@/lib/growth-engine/env";
import { requireAdmin } from "@/lib/seo/guards";

function escapeCsv(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

export async function GET() {
  if (!isGrowthEngineEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin.response;
  }

  const headers = [
    "rank",
    "title",
    "slug",
    "page_type",
    "service_offering",
    "primary_keyword",
    "supporting_keywords",
    "search_intent",
    "buyer_intent",
    "revenue_potential",
    "conversion_likelihood",
    "target_audience",
    "content_angle",
    "offer_angle",
    "cta_recommendation",
    "expected_revenue_value",
    "why_it_matters",
    "status",
  ];

  const rows = topRevenuePages.map((page) => [
    page.rank,
    page.title,
    page.slug,
    page.pageType,
    page.serviceOffering,
    page.primaryKeyword,
    page.supportingKeywords.join("; "),
    page.searchIntent,
    page.buyerIntent,
    page.revenuePotential,
    page.conversionLikelihood,
    page.targetAudience,
    page.contentAngle,
    page.offerAngle,
    page.ctaRecommendation,
    page.expectedRevenueValue,
    page.whyItMatters,
    page.status,
  ]);

  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"homereach-top-25-revenue-pages.csv\"",
      "Cache-Control": "no-store",
    },
  });
}
