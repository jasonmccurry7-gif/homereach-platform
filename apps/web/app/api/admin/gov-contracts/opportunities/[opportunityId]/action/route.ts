import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { logGovContractAuditEvent } from "@/lib/gov-contracts/data";
import { buildBidNoBidDecision, loadGovContractBidWorkspace, startGovContractBidWorkspace } from "@/lib/gov-contracts/execution";
import { createServiceClient } from "@/lib/supabase/service";
import type { GovContractPipelineStatus } from "@/lib/gov-contracts/types";

type GovContractAction =
  | "save"
  | "assign_owner"
  | "evaluate_fit"
  | "no_bid"
  | "team_opportunity"
  | "find_subcontractor"
  | "export_opportunity"
  | "build_response_package";

const ACTION_STATUS: Record<GovContractAction, GovContractPipelineStatus> = {
  save: "saved",
  assign_owner: "reviewing",
  evaluate_fit: "qualifying",
  no_bid: "no_bid",
  team_opportunity: "need_subcontractor",
  find_subcontractor: "need_subcontractor",
  export_opportunity: "reviewing",
  build_response_package: "bid_prep",
};

const WORKSPACE_ACTIONS = new Set<GovContractAction>([
  "build_response_package",
  "find_subcontractor",
  "team_opportunity",
]);

function actionRedirectTo(action: GovContractAction, opportunityId: string) {
  const encoded = encodeURIComponent(opportunityId);
  if (action === "save") return "/admin/gov-contracts?status=saved";
  if (action === "assign_owner") return "/admin/gov-contracts?status=reviewing";
  if (action === "evaluate_fit") return `/admin/gov-contracts/${encoded}/bid-room?tab=overview`;
  if (action === "no_bid") return "/admin/gov-contracts?status=no_bid";
  if (action === "team_opportunity") return `/admin/gov-contracts/${encoded}/bid-room?tab=crm`;
  if (action === "find_subcontractor") return `/admin/gov-contracts/${encoded}/bid-room?tab=subcontractors`;
  if (action === "export_opportunity") return `/admin/gov-contracts/${encoded}/review-packet`;
  if (action === "build_response_package") return `/admin/gov-contracts/${encoded}/bid-room?tab=proposal`;
  return `/admin/gov-contracts/${encoded}`;
}

function hasSupabaseServiceEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ opportunityId: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { opportunityId } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: GovContractAction;
    note?: string;
  };

  if (!body.action || !(body.action in ACTION_STATUS)) {
    return NextResponse.json({ ok: false, error: "Invalid government contract action." }, { status: 400 });
  }

  const { opportunity, workspace } = await loadGovContractBidWorkspace(decodeURIComponent(opportunityId));
  if (!opportunity) {
    return NextResponse.json({ ok: false, error: "Opportunity not found." }, { status: 404 });
  }
  let workspaceSnapshot = workspace;

  const nextStatus = ACTION_STATUS[body.action];
  const decision = buildBidNoBidDecision(opportunity);
  const metadata = {
    note: body.note ?? null,
    action: body.action,
    recommendation: decision.recommendation,
    missingRequirements: decision.missingRequirements,
  };

  let persisted = false;
  let bidRoomId: string | null = null;
  let warning: string | null = null;
  if (!opportunity.isSample && hasSupabaseServiceEnv()) {
    const supabase = createServiceClient();
    const update: Record<string, unknown> = {
      pipeline_status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (body.action === "save") update.saved_at = new Date().toISOString();
    if (body.action === "assign_owner") update.owner_id = guard.user?.id ?? null;
    if (body.action === "evaluate_fit") update.evaluated_at = new Date().toISOString();

    const { error } = await supabase
      .from("gov_contract_opportunities")
      .update(update)
      .eq("id", opportunity.id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    persisted = true;
  }

  if (WORKSPACE_ACTIONS.has(body.action)) {
    const workspaceResult = await startGovContractBidWorkspace({
      opportunityId: opportunity.id,
      actorId: guard.user?.id ?? null,
      bidStage: nextStatus,
      opportunityStatus: nextStatus,
    });

    if (!workspaceResult.ok) {
      if (!workspaceResult.workspace || !workspaceResult.opportunity) {
        return NextResponse.json(
          { ok: false, error: workspaceResult.error ?? "Unable to prepare bid workspace." },
          { status: 500 }
        );
      }

      warning = workspaceResult.error
        ? `Opened safe preview because persistence is blocked: ${workspaceResult.error}`
        : "Opened safe preview because persistence is blocked.";
      persisted = false;
      bidRoomId = workspaceResult.workspace.id ?? null;
      workspaceSnapshot = workspaceResult.workspace;
    } else {
      persisted = persisted || workspaceResult.persisted;
      bidRoomId = workspaceResult.workspace?.id ?? null;
      workspaceSnapshot = workspaceResult.workspace ?? workspaceSnapshot;
    }
  }

  await logGovContractAuditEvent({
    opportunityId: opportunity.isSample ? null : opportunity.id,
    actorId: guard.user?.id,
    eventType: `workflow_action_${body.action}`,
    summary: `Government contract action recorded: ${body.action}.`,
    metadata: { ...metadata, bidRoomId },
  });

  await logPlatformAuditEvent({
    actorType: "human",
    actorId: guard.user?.id ?? null,
    module: "government_contracts",
    actionType: `workflow_action_${body.action}`,
    entityType: "gov_contract_opportunity",
    entityId: opportunity.id,
    sourceTable: "gov_contract_opportunities",
    sourceId: opportunity.id,
    resultStatus: "success",
    approvalState: body.action === "no_bid" ? "approved" : "needs_review",
    severity: body.action === "no_bid" ? "low" : "info",
    message: `Government contract workflow action recorded: ${body.action}.`,
    metadata: { ...metadata, bidRoomId },
  });

  return NextResponse.json({
    ok: true,
    persisted,
    warning,
    bidRoomId,
    status: nextStatus,
    redirectTo: actionRedirectTo(body.action, opportunity.id),
    recommendation: decision.recommendation,
    marketResearch: workspaceSnapshot
      ? {
          status: workspaceSnapshot.marketResearch.researchStatus,
          freshnessLabel: workspaceSnapshot.marketResearch.freshnessLabel,
          sourceGaps: workspaceSnapshot.marketResearch.sourceGaps,
        }
      : null,
    pricingWarnings: workspaceSnapshot
      ? {
          priceReasonablenessStatus: workspaceSnapshot.pricing.priceReasonablenessStatus,
          underbidRiskScore: workspaceSnapshot.pricing.underbidRiskScore,
          cashFlowRiskScore: workspaceSnapshot.pricing.cashFlowRiskScore,
        }
      : null,
  });
}
