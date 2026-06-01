import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { startGovContractBidWorkspace } from "@/lib/gov-contracts/execution";

export async function POST(
  _req: Request,
  context: { params: Promise<{ opportunityId: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { opportunityId } = await context.params;
  const result = await startGovContractBidWorkspace({
    opportunityId: decodeURIComponent(opportunityId),
    actorId: guard.user?.id,
  });

  if (!result.ok) {
    if (result.opportunity && result.workspace) {
      return NextResponse.json({
        ok: true,
        persisted: false,
        bidRoomId: result.workspace.id ?? null,
        warning: result.error
          ? `Bid workspace opened in safe preview mode because persistence is blocked: ${result.error}`
          : "Bid workspace opened in safe preview mode because persistence is blocked.",
        marketResearch: {
          status: result.workspace.marketResearch.researchStatus,
          freshnessLabel: result.workspace.marketResearch.freshnessLabel,
          summary: result.workspace.marketResearch.executiveSummary,
          sourceGaps: result.workspace.marketResearch.sourceGaps,
        },
        pricingWarnings: {
          priceReasonablenessStatus: result.workspace.pricing.priceReasonablenessStatus,
          underbidRiskScore: result.workspace.pricing.underbidRiskScore,
          cashFlowRiskScore: result.workspace.pricing.cashFlowRiskScore,
          underpricingWarning: result.workspace.pricing.underpricingWarning,
          cashFlowWarning: result.workspace.pricing.cashFlowWarning,
        },
        redirectTo: `/admin/gov-contracts/${encodeURIComponent(result.opportunity.id)}/bid-room?tab=overview&mode=preview`,
      });
    }

    return NextResponse.json(
      { ok: false, error: result.error ?? "Unable to start bid." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    persisted: result.persisted,
    bidRoomId: result.workspace?.id ?? null,
    marketResearch: result.workspace
      ? {
          status: result.workspace.marketResearch.researchStatus,
          freshnessLabel: result.workspace.marketResearch.freshnessLabel,
          summary: result.workspace.marketResearch.executiveSummary,
          sourceGaps: result.workspace.marketResearch.sourceGaps,
        }
      : null,
    pricingWarnings: result.workspace
      ? {
          priceReasonablenessStatus: result.workspace.pricing.priceReasonablenessStatus,
          underbidRiskScore: result.workspace.pricing.underbidRiskScore,
          cashFlowRiskScore: result.workspace.pricing.cashFlowRiskScore,
          underpricingWarning: result.workspace.pricing.underpricingWarning,
          cashFlowWarning: result.workspace.pricing.cashFlowWarning,
        }
      : null,
    redirectTo: result.opportunity
      ? `/admin/gov-contracts/${encodeURIComponent(result.opportunity.id)}/bid-room?tab=overview`
      : null,
  });
}
