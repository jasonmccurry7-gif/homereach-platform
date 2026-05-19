import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";
import { logGovContractAuditEvent } from "@/lib/gov-contracts/data";
import type { GovContractPipelineStatus } from "@/lib/gov-contracts/types";

const VALID_STATUSES: GovContractPipelineStatus[] = [
  "new",
  "reviewing",
  "strong_fit",
  "need_subcontractor",
  "bid_prep",
  "awaiting_approval",
  "submitted",
  "awarded",
  "lost",
  "no_bid",
  "archived",
];

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
    status?: GovContractPipelineStatus;
    note?: string;
  };

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ ok: false, error: "Invalid pipeline status." }, { status: 400 });
  }

  if (opportunityId.startsWith("sample-") || !hasSupabaseServiceEnv()) {
    return NextResponse.json({
      ok: true,
      persisted: false,
      status: body.status,
      message: "Sample opportunity updated locally. Apply the database migration to persist status changes.",
    });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("gov_contract_opportunities")
    .update({
      pipeline_status: body.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opportunityId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await logGovContractAuditEvent({
    opportunityId,
    actorId: guard.user?.id,
    eventType: "pipeline_status_updated",
    summary: `Pipeline status changed to ${body.status}.`,
    metadata: { note: body.note ?? null },
  });

  return NextResponse.json({ ok: true, persisted: true, status: body.status });
}
