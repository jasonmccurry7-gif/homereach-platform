import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { loadAgentIntegrationPolicyData } from "@/lib/agent-integrations/repository";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const data = await loadAgentIntegrationPolicyData();
  return NextResponse.json({ ok: true, data });
}
