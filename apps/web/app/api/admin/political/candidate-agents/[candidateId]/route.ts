import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchAndStoreCampaignManagerEmails } from "@/lib/political/campaign-manager-email-search";
import { buildCandidateLaunchReadiness } from "@/lib/political/candidate-readiness";
import { isCandidateLaunchAgentEnabled, isPoliticalEnabled } from "@/lib/political/env";
import { createServiceClient } from "@/lib/supabase/service";
import {
  approveCandidateLaunchPlan,
  generateCandidateLaunchPlan,
  generateCandidateProposalDraft,
  generateSalesFollowUpDraft,
  loadCandidateAgentWorkspace,
  markCandidatePlanProductionReady,
  runCandidateResearch,
  updateCandidateLaunchPlanDraft,
} from "@/lib/political/candidate-launch-agent";

interface RouteContext {
  params: Promise<{ candidateId: string }>;
}

async function requirePoliticalAgentAccess() {
  if (!isPoliticalEnabled() || !isCandidateLaunchAgentEnabled()) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const role = user.app_metadata?.user_role;
  if (role !== "admin" && role !== "sales_agent") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status = message.includes("migration") ? 503 : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isAdminUser(user: unknown) {
  const metadata = (user as { app_metadata?: Record<string, unknown> } | null | undefined)?.app_metadata;
  return metadata?.user_role === "admin";
}

function requireLatestPlanId(
  workspace: Awaited<ReturnType<typeof loadCandidateAgentWorkspace>>,
  requestedPlanId: string | undefined,
) {
  const latestPlanId = workspace.latestPlan?.id ?? null;
  const planId = requestedPlanId ?? latestPlanId;
  if (!planId) {
    return { error: "No launch plan is available.", status: 400 };
  }
  if (planId !== latestPlanId) {
    return {
      error: "Plan mutation blocked because the requested plan is not the latest plan for this candidate.",
      status: 409,
    };
  }
  return { planId };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const access = await requirePoliticalAgentAccess();
    if ("error" in access) return access.error;
    const { candidateId } = await context.params;
    const workspace = await loadCandidateAgentWorkspace(candidateId);
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const access = await requirePoliticalAgentAccess();
    if ("error" in access) return access.error;
    const { candidateId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      planId?: string;
      notes?: string;
      recommendedStrategy?: string;
      operatorNotes?: string;
    };

    switch (body.action) {
      case "research": {
        const result = await runCandidateResearch(candidateId, access.user.id);
        return NextResponse.json({ ok: true, action: body.action, result });
      }
      case "manager_email_search": {
        const result = await searchAndStoreCampaignManagerEmails(createServiceClient(), {
          candidateId,
          limit: 1,
          force: true,
          includeSearchEngine: true,
          actorUserId: access.user.id,
        });
        return NextResponse.json({ ok: true, action: body.action, result });
      }
      case "plan": {
        const result = await generateCandidateLaunchPlan(candidateId, access.user.id);
        return NextResponse.json({ ok: true, action: body.action, result });
      }
      case "proposal_draft": {
        const workspace = await loadCandidateAgentWorkspace(candidateId);
        if (!workspace.latestPlan) {
          await generateCandidateLaunchPlan(candidateId, access.user.id);
        }
        const draft = await generateCandidateProposalDraft(candidateId);
        return NextResponse.json({ ok: true, action: body.action, draft });
      }
      case "creative_briefs": {
        let workspace = await loadCandidateAgentWorkspace(candidateId);
        if (!workspace.latestPlan) {
          await generateCandidateLaunchPlan(candidateId, access.user.id);
          workspace = await loadCandidateAgentWorkspace(candidateId);
        }
        return NextResponse.json({
          ok: true,
          action: body.action,
          creative_briefs: workspace.latestPlan?.planJson.creative_briefs ?? [],
        });
      }
      case "sales_follow_up": {
        const draft = await generateSalesFollowUpDraft(candidateId, access.user.id);
        return NextResponse.json({ ok: true, action: body.action, draft });
      }
      case "approve_plan": {
        if (!isAdminUser(access.user)) {
          return NextResponse.json({ ok: false, error: "Admin approval is required to mark political plans reviewed." }, { status: 403 });
        }
        const workspace = await loadCandidateAgentWorkspace(candidateId);
        if (!workspace.candidate) {
          return NextResponse.json({ ok: false, error: "Candidate not found." }, { status: 404 });
        }
        const readiness = buildCandidateLaunchReadiness({
          candidate: workspace.candidate,
          latestResearch: workspace.latestResearch,
          latestPlan: workspace.latestPlan,
        });
        if (!readiness.approvalEnabled) {
          return NextResponse.json(
            { ok: false, error: `Verified launch gate blocked: ${readiness.nextRequiredAction}` },
            { status: 400 },
          );
        }
        const planResolution = requireLatestPlanId(workspace, body.planId);
        if ("error" in planResolution) {
          return NextResponse.json({ ok: false, error: planResolution.error }, { status: planResolution.status });
        }
        const plan = await approveCandidateLaunchPlan(planResolution.planId, access.user.id, body.notes);
        return NextResponse.json({ ok: true, action: body.action, plan });
      }
      case "save_plan_edits": {
        const workspace = await loadCandidateAgentWorkspace(candidateId);
        const planResolution = requireLatestPlanId(workspace, body.planId);
        if ("error" in planResolution) {
          return NextResponse.json({ ok: false, error: planResolution.error }, { status: planResolution.status });
        }
        const plan = await updateCandidateLaunchPlanDraft(
          {
            planId: planResolution.planId,
            recommendedStrategy: body.recommendedStrategy,
            operatorNotes: body.operatorNotes,
          },
          access.user.id,
        );
        return NextResponse.json({ ok: true, action: body.action, plan });
      }
      case "production_queue": {
        if (!isAdminUser(access.user)) {
          return NextResponse.json({ ok: false, error: "Admin approval is required to stage political plans for production review." }, { status: 403 });
        }
        const workspace = await loadCandidateAgentWorkspace(candidateId);
        if (!workspace.candidate) {
          return NextResponse.json({ ok: false, error: "Candidate not found." }, { status: 404 });
        }
        const readiness = buildCandidateLaunchReadiness({
          candidate: workspace.candidate,
          latestResearch: workspace.latestResearch,
          latestPlan: workspace.latestPlan,
        });
        if (!readiness.productionEnabled) {
          return NextResponse.json(
            { ok: false, error: `Verified launch gate blocked: ${readiness.nextRequiredAction}` },
            { status: 400 },
          );
        }
        const planResolution = requireLatestPlanId(workspace, body.planId);
        if ("error" in planResolution) {
          return NextResponse.json({ ok: false, error: planResolution.error }, { status: planResolution.status });
        }
        const plan = await markCandidatePlanProductionReady(planResolution.planId, access.user.id);
        return NextResponse.json({ ok: true, action: body.action, plan });
      }
      default:
        return NextResponse.json(
          { ok: false, error: "action must be one of: research, manager_email_search, plan, proposal_draft, creative_briefs, sales_follow_up, approve_plan, save_plan_edits, production_queue" },
          { status: 400 },
        );
    }
  } catch (error) {
    return errorResponse(error);
  }
}
