import { NextResponse } from "next/server";
import {
  hasGrowthIntelligencePersistence,
  isGrowthIntelligenceEnabled,
} from "@/lib/growth-intelligence/config";
import { recordGrowthIntelligenceAction } from "@/lib/growth-intelligence/engine";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type RouteParams = Promise<{ opportunityId: string }>;

function normalizeEmail(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase();
}

function isAllowedAction(value: unknown) {
  return [
    "review",
    "launch",
    "create_campaign",
    "create_proposal",
    "assign_task",
    "approve",
    "complete",
    "dismiss",
    "copy_draft",
  ].includes(String(value));
}

export async function POST(
  request: Request,
  { params }: { params: RouteParams },
) {
  const { opportunityId } = await params;
  if (!isGrowthIntelligenceEnabled()) {
    return NextResponse.json({ error: "Growth Intelligence is disabled." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasGrowthIntelligencePersistence()) {
    return NextResponse.json(
      { error: "Growth Intelligence persistence is not configured.", safeMode: true },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const actionType = String(body.actionType ?? "");
  if (!isAllowedAction(actionType)) {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: opportunity, error } = await service
    .from("growth_intelligence_opportunities")
    .select("id,client_id,client_email")
    .eq("id", opportunityId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = user.app_metadata?.user_role;
  const isAdmin = role === "admin" || role === "sales_agent";
  const isOwner =
    opportunity.client_id === user.id ||
    normalizeEmail(opportunity.client_email) === normalizeEmail(user.email);
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await recordGrowthIntelligenceAction({
      supabase: service,
      opportunityId,
      actionType,
      actorUserId: user.id,
      actorRole: String(role ?? "client"),
      notes: typeof body.notes === "string" ? body.notes : null,
      draftId: typeof body.draftId === "string" ? body.draftId : null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[growth-intelligence/action] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Growth Intelligence action failed" },
      { status: 500 },
    );
  }
}
