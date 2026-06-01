import { NextRequest, NextResponse } from "next/server";
import {
  storeArvowWebhookDraft,
  verifyArvowWebhookSecret,
} from "@/lib/growth-engine/integrations";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";

export async function POST(request: NextRequest) {
  const verification = verifyArvowWebhookSecret(request.headers, request.url);
  if (!verification.ok) {
    await logPlatformAuditEvent({
      actorType: "webhook",
      module: "growth_engine",
      actionType: "arvow_webhook_rejected",
      provider: "arvow",
      resultStatus: "blocked",
      approvalState: "needs_review",
      severity: verification.status === 503 ? "high" : "medium",
      message: verification.message,
    });
    return NextResponse.json({ ok: false, message: verification.message }, { status: verification.status });
  }

  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    await logPlatformAuditEvent({
      actorType: "webhook",
      module: "growth_engine",
      actionType: "arvow_webhook_invalid_json",
      provider: "arvow",
      resultStatus: "failure",
      approvalState: "needs_review",
      severity: "medium",
      message: "Arvow webhook received invalid JSON.",
    });
    return NextResponse.json({ ok: false, message: "Invalid JSON payload." }, { status: 400 });
  }

  const stored = await storeArvowWebhookDraft(payload);
  await logPlatformAuditEvent({
    actorType: "webhook",
    module: "growth_engine",
    actionType: "arvow_webhook_received",
    provider: "arvow",
    resultStatus: stored.stored ? "success" : "warning",
    approvalState: "needs_review",
    severity: stored.stored ? "info" : "medium",
    entityType: "ai_output",
    entityId: stored.id,
    message: stored.stored
      ? "Arvow draft captured for human review."
      : "Arvow webhook accepted but draft storage needs review.",
    errorMessage: stored.error,
  });

  return NextResponse.json(
    {
      ok: true,
      stored: stored.stored,
      outputId: stored.id,
      message: stored.stored
        ? "Arvow content saved as a review-only AI output."
        : "Arvow webhook accepted; storage was skipped or unavailable.",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
