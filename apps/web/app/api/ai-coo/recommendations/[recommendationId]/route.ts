import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/api-guards";
import { recordAiCooAction } from "@/lib/ai-coo/recommendations";
import { isAiCooEnabled } from "@/lib/ai-coo/config";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type Params = Promise<{ recommendationId: string }>;

const ALLOWED_ACTION_TYPES = new Set([
  "launch",
  "review",
  "create_campaign",
  "create_proposal",
  "assign_task",
  "review_savings",
  "launch_campaign",
  "create_draft",
  "assign",
  "fix",
  "dismiss",
  "approve",
  "complete",
  "copy_email",
  "copy_sms",
  "copy_dm",
  "copy_proposal_intro",
  "copy_client_follow_up",
  "copy_renewal_message",
  "copy_upsell_message",
]);

const ActionSchema = z.object({
  actionType: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((value) => ALLOWED_ACTION_TYPES.has(value), "Unsupported AI COO action type."),
  label: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
  draftId: z.string().uuid().optional(),
});

export async function POST(request: Request, context: { params: Params }) {
  if (!isAiCooEnabled()) {
    return NextResponse.json({ error: "AI COO is disabled." }, { status: 404 });
  }

  const guard = await requireRole(["admin", "sales_agent", "client"]);
  if (!guard.ok) return guard.response;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "AI COO persistence is not configured.", safeMode: true }, { status: 503 });
  }

  const { recommendationId } = await context.params;
  const parsed = ActionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid AI COO action payload." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: recommendation, error } = await (supabase as any)
    .from("ai_coo_recommendations")
    .select("id, client_id, client_email")
    .eq("id", recommendationId)
    .single();

  if (error || !recommendation) {
    return NextResponse.json({ error: "AI COO recommendation not found." }, { status: 404 });
  }

  const role = guard.user?.app_metadata?.user_role as string | undefined;
  const userEmail = String(guard.user?.email ?? "").toLowerCase();
  const ownsRecommendation =
    recommendation.client_id === guard.user?.id ||
    String(recommendation.client_email ?? "").toLowerCase() === userEmail;

  if (role === "client" && !ownsRecommendation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await recordAiCooAction({
      supabase,
      recommendationId,
      actionType: parsed.data.actionType,
      actorUserId: guard.user?.id ?? null,
      actorRole: role ?? "user",
      label: parsed.data.label,
      notes: parsed.data.notes,
      draftId: parsed.data.draftId,
    });

    return NextResponse.json({
      ok: true,
      status: result.status,
      actionStatus: result.actionStatus,
      approvalRequired: true,
      noAutonomousAction: true,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "AI COO action failed.",
        approvalRequired: true,
        noAutonomousAction: true,
      },
      { status: 500 },
    );
  }
}
