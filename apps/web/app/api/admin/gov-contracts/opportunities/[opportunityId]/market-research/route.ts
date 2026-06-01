import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { logGovContractAuditEvent } from "@/lib/gov-contracts/data";
import { loadGovContractBidWorkspace } from "@/lib/gov-contracts/execution";
import { runGovContractLiveMarketResearch } from "@/lib/gov-contracts/market-research";

export async function GET(
  _req: Request,
  context: { params: Promise<{ opportunityId: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { opportunityId } = await context.params;
  const { opportunity, workspace } = await loadGovContractBidWorkspace(decodeURIComponent(opportunityId));
  if (!opportunity || !workspace) {
    return NextResponse.json({ ok: false, error: "Opportunity not found." }, { status: 404 });
  }

  const packet = await runGovContractLiveMarketResearch(opportunity, workspace.pricing);

  await logGovContractAuditEvent({
    opportunityId: opportunity.isSample ? null : opportunity.id,
    actorId: guard.user?.id ?? null,
    eventType: "market_research_packet_generated",
    summary: "Government contract market research packet generated for human pricing review.",
    metadata: {
      bidRoomId: workspace.id,
      researchStatus: packet.researchStatus,
      confidence: packet.confidence,
      sourceCount: packet.sourceLinks.length,
      subcontractorCandidateCount: packet.subcontractorCandidates.length,
    },
  });

  await logPlatformAuditEvent({
    actorType: "human",
    actorId: guard.user?.id ?? null,
    module: "government_contracts",
    actionType: "market_research_packet_generated",
    entityType: "gov_contract_opportunity",
    entityId: opportunity.id,
    sourceTable: "gov_contract_opportunities",
    sourceId: opportunity.id,
    resultStatus: "success",
    approvalState: "needs_review",
    severity: "info",
    message: "Government contract market research packet generated.",
    metadata: {
      bidRoomId: workspace.id,
      confidence: packet.confidence,
      sourceGaps: packet.sourceGaps,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      marketResearch: packet,
      warnings: [
        "Market research is advisory until official solicitation, prior awards, and subcontractor quotes are verified.",
        "This endpoint does not approve pricing, contact subcontractors, or submit bids.",
      ],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
