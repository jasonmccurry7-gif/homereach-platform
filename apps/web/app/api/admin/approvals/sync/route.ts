import { NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { syncApprovalLedgerFromSpine } from "@/lib/approvals/ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const result = await syncApprovalLedgerFromSpine({
    actorId: guard.user?.id ?? null,
    actorLabel: guard.user ? "admin" : "cron",
    eventType: "approval_spine_sync",
  });

  await logPlatformAuditEvent({
    actorType: guard.user ? "human" : "cron",
    actorId: guard.user?.id ?? null,
    module: "approvals",
    actionType: "approval_ledger_synced",
    entityType: "approval_ledger",
    resultStatus: result.ok ? "success" : "failure",
    severity: result.ok ? "info" : "high",
    message: result.ok
      ? `Approval ledger synced with ${result.synced} projected approval item${result.synced === 1 ? "" : "s"}.`
      : "Approval ledger sync failed.",
    errorMessage: result.error,
    metadata: {
      synced: result.synced,
      events: result.events,
    },
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
