import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { logGovContractAuditEvent } from "@/lib/gov-contracts/data";
import { buildBidExportPackage, loadGovContractBidWorkspace } from "@/lib/gov-contracts/execution";

export async function GET(
  _req: Request,
  context: { params: Promise<{ opportunityId: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { opportunityId } = await context.params;
  const { opportunity, workspace } = await loadGovContractBidWorkspace(decodeURIComponent(opportunityId));
  if (!opportunity || !workspace) {
    return NextResponse.json({ ok: false, error: "Bid workspace not found." }, { status: 404 });
  }

  const packageJson = buildBidExportPackage(opportunity, workspace);

  await logGovContractAuditEvent({
    opportunityId: opportunity.isSample ? null : opportunity.id,
    actorId: guard.user?.id ?? null,
    eventType: "bid_package_previewed",
    summary: "Government contract response package previewed for human review.",
    metadata: {
      bidRoomId: workspace.id,
      approvalStatus: workspace.approvalStatus,
      destination: packageJson.destination,
      solicitationNumber: opportunity.solicitationNumber,
    },
  });

  await logPlatformAuditEvent({
    actorType: "human",
    actorId: guard.user?.id ?? null,
    module: "government_contracts",
    actionType: "bid_package_previewed",
    entityType: "gov_contract_opportunity",
    entityId: opportunity.id,
    sourceTable: "gov_contract_opportunities",
    sourceId: opportunity.id,
    resultStatus: "success",
    approvalState: "needs_review",
    severity: "info",
    message: "Government contract response package previewed for human review.",
    metadata: {
      bidRoomId: workspace.id,
      solicitationNumber: opportunity.solicitationNumber,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      package: packageJson,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
