import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import {
  approveAction,
  pauseAction,
  pauseAllOutbound,
  queueAction,
  rejectAction,
  rewriteAction,
  sendApprovedActions,
} from "@/lib/voice-command-center/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function voiceApprovalFrom(body: Record<string, unknown>) {
  return {
    sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
    approvalPhrase: typeof body.approvalPhrase === "string" ? body.approvalPhrase : undefined,
    transcriptSnippet: typeof body.transcriptSnippet === "string" ? body.transcriptSnippet : undefined,
    confidenceScore: typeof body.confidenceScore === "number" ? body.confidenceScore : undefined,
  };
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = asRecord(await req.json().catch(() => ({})));
  const intent = typeof body.intent === "string" ? body.intent : "";
  const actionId = typeof body.actionId === "string" ? body.actionId : "";

  if (intent === "queue") {
    const actionType = typeof body.actionType === "string" ? body.actionType : "internal_task";
    if (!["email", "sms", "dm", "proposal", "follow_up", "internal_task"].includes(actionType)) {
      return NextResponse.json({ ok: false, error: "Unsupported actionType" }, { status: 400 });
    }

    const result = await queueAction({
      actionType: actionType as "email" | "sms" | "dm" | "proposal" | "follow_up" | "internal_task",
      channel: typeof body.channel === "string" ? body.channel : actionType,
      recipientName: typeof body.recipientName === "string" ? body.recipientName : null,
      recipientEmail: typeof body.recipientEmail === "string" ? body.recipientEmail : null,
      recipientPhone: typeof body.recipientPhone === "string" ? body.recipientPhone : null,
      businessName: typeof body.businessName === "string" ? body.businessName : null,
      city: typeof body.city === "string" ? body.city : null,
      vertical: typeof body.vertical === "string" ? body.vertical : null,
      subject: typeof body.subject === "string" ? body.subject : null,
      body: typeof body.messageBody === "string" ? body.messageBody : "",
      riskLevel: body.riskLevel === "low" || body.riskLevel === "high" ? body.riskLevel : "medium",
      createdByAgent: typeof body.createdByAgent === "string" ? body.createdByAgent : "Voice Command Center",
      createdBy: user.id,
      metadata: { source: "voice_command_center_api" },
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  if (intent === "send_now") {
    const actionIds = Array.isArray(body.actionIds)
      ? body.actionIds.filter((id): id is string => typeof id === "string")
      : actionId
        ? [actionId]
        : [];

    if (!actionIds.length) {
      return NextResponse.json({ ok: false, error: "At least one action id is required" }, { status: 400 });
    }

    const result = await sendApprovedActions(actionIds, user.id, voiceApprovalFrom(body));
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  if (intent === "pause_all") {
    const result = await pauseAllOutbound(user.id, voiceApprovalFrom(body));
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  if (!actionId) {
    return NextResponse.json({ ok: false, error: "actionId is required" }, { status: 400 });
  }

  if (intent === "approve") {
    const result = await approveAction(actionId, user.id, voiceApprovalFrom(body));
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  if (intent === "reject") {
    const result = await rejectAction(actionId, user.id, voiceApprovalFrom(body));
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  if (intent === "pause") {
    const result = await pauseAction(actionId, user.id, voiceApprovalFrom(body));
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  if (intent === "rewrite") {
    const messageBody = typeof body.messageBody === "string" ? body.messageBody : "";
    if (!messageBody.trim()) {
      return NextResponse.json({ ok: false, error: "messageBody is required for rewrite" }, { status: 400 });
    }

    const result = await rewriteAction(actionId, user.id, messageBody, voiceApprovalFrom(body));
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  return NextResponse.json({ ok: false, error: "Unsupported voice command action" }, { status: 400 });
}
