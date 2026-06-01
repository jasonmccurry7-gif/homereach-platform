import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { searchAndStoreCampaignManagerEmails } from "@/lib/political/campaign-manager-email-search";
import { isPoliticalEnabled } from "@/lib/political/env";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isPoliticalEnabled()) {
    return NextResponse.json({ error: "Political module is disabled." }, { status: 404 });
  }

  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as {
    candidateId?: string;
    limit?: number;
    force?: boolean;
    includeSearchEngine?: boolean;
    maxPagesPerCandidate?: number;
  };

  const supabase = createServiceClient();
  const result = await searchAndStoreCampaignManagerEmails(supabase, {
    candidateId: body.candidateId,
    limit: body.candidateId ? 1 : Math.max(1, Math.min(body.limit ?? 40, 100)),
    force: Boolean(body.force),
    includeSearchEngine: Boolean(body.includeSearchEngine),
    maxPagesPerCandidate: Math.max(1, Math.min(body.maxPagesPerCandidate ?? 6, 9)),
    actorUserId: guard.user?.id ?? null,
  });

  return NextResponse.json({ ok: true, ...result });
}
