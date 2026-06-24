import { NextResponse } from "next/server";
import { sendEmail, sendSms } from "@homereach/services/outreach";
import { requireAdmin, requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { createGuardedServiceRoleClient } from "@/lib/security/guarded-service-role";
import {
  createStormReachAutopilotAssetsForStormEvent,
  createStormReachAutopilotCampaign,
  draftStormReachAutopilotOutreachForStormEvent,
  runStormReachAutopilot,
  stormReachAutopilotState,
} from "@/lib/stormreach/autopilot";
import { runStormReachOperatorAgent } from "@/lib/stormreach/operator-agent";
import {
  createManualOverdriveStormEvent,
  createOverdriveCampaignPackagesForStormEvent,
  runStormReachOverdriveMode,
  STORMREACH_OVERDRIVE_SERVICE_CATEGORIES,
  stormReachOverdriveState,
  type ManualStormEventInput,
} from "@/lib/stormreach/overdrive";
import {
  buildCampaignPackagesForStormEvent,
  draftOutreachForStormEvent,
  generateProspectsForStormEvent,
  ingestStormReachEvents,
  loadStormReachDashboard,
  runStormReachContinuousSweep,
  runStormReachStrategist,
  updateStormEventStatus,
} from "@/lib/stormreach/repository";
import { evaluateStormReachSendPolicy, stormReachDailySendLimit, stormReachRuntimeVerified } from "@/lib/stormreach/approval-and-send-engine";
import { normalizePhone, STORMREACH_CORE_CONTRACTOR_INDUSTRIES, stormReachContractorSearchRadiusMiles } from "@/lib/stormreach/prospecting";
import type { StormEventStatus } from "@/lib/stormreach/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  const { supabase } = createGuardedServiceRoleClient({
    allowedRoles: ["admin", "sales_agent"],
    guard,
    purpose: "Read StormReach opportunity dashboard",
    route: "/api/admin/stormreach",
  });

  const data = await loadStormReachDashboard(supabase);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { actor, supabase } = createGuardedServiceRoleClient({
    allowedRoles: ["admin"],
    guard,
    purpose: "Run approval-gated StormReach admin action",
    route: "/api/admin/stormreach",
  });
  const body = await request.json().catch(() => ({})) as {
    action?: string;
    eventId?: string;
    status?: StormEventStatus;
    industries?: string[];
    prospectIds?: string[];
    limit?: number;
    weekly?: boolean;
    assetLimit?: number;
    state?: string;
    messageId?: string;
    packageId?: string;
    manualEvent?: ManualStormEventInput;
  };
  const action = body.action ?? "ingest";

  if (action === "ingest") {
    return NextResponse.json(await ingestStormReachEvents({ supabase, actor, limit: body.limit }));
  }

  if (action === "continuous_sweep") {
    return NextResponse.json(await runStormReachContinuousSweep({ supabase, actor, prospectLimit: body.limit, emailLimit: body.limit }));
  }

  if (action === "overdrive_refresh") {
    return NextResponse.json(await runStormReachOverdriveMode({
      supabase,
      actor,
      state: body.state || stormReachOverdriveState(),
      eventLimit: body.limit,
      prospectLimit: body.limit,
      draftLimit: body.limit,
    }));
  }

  if (action === "run_autopilot") {
    if (!stormReachRuntimeVerified()) {
      return NextResponse.json(
        {
          ok: false,
          error: "StormReach autopilot requires runtime verification before this action can run.",
          approvalRequired: true,
        },
        { status: 412 },
      );
    }
    return NextResponse.json(await runStormReachAutopilot({
      supabase,
      actor,
      state: body.state || stormReachAutopilotState(),
      eventLimit: body.limit,
      prospectLimit: body.limit,
      draftLimit: body.limit,
      assetLimit: body.assetLimit,
    }));
  }

  if (action === "manual_overdrive_event") {
    return NextResponse.json(await createManualOverdriveStormEvent(body.manualEvent ?? {}, { supabase, actor }));
  }

  if (action === "run_strategist") {
    return NextResponse.json(await runStormReachStrategist({ supabase, actor, weekly: body.weekly }));
  }

  if (action === "run_operator") {
    return NextResponse.json(await runStormReachOperatorAgent({
      supabase,
      actor,
      eventLimit: body.limit,
      prospectLimit: body.limit,
      emailLimit: body.limit,
      assetLimit: body.assetLimit,
    }));
  }

  const eventlessActions = new Set(["approve_outreach", "reject_outreach", "send_outreach", "approve_package"]);
  if (!body.eventId && !eventlessActions.has(action)) {
    return NextResponse.json({ ok: false, error: "eventId is required for this StormReach action." }, { status: 400 });
  }
  const eventId = body.eventId!;

  if (action === "generate_prospects") {
    return NextResponse.json(await generateProspectsForStormEvent(eventId, {
      supabase,
      actor,
      limit: body.limit,
      industries: body.industries?.length ? body.industries : STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
      radiusMiles: stormReachContractorSearchRadiusMiles(),
      coreContractorMode: true,
    }));
  }

  if (action === "draft_outreach") {
    return NextResponse.json(await draftOutreachForStormEvent(eventId, {
      supabase,
      actor,
      prospectIds: body.prospectIds,
      limit: body.limit,
      industries: body.industries?.length ? body.industries : STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
      includeMissingEmail: true,
    }));
  }

  if (action === "draft_autopilot_outreach") {
    return NextResponse.json(await draftStormReachAutopilotOutreachForStormEvent(eventId, {
      supabase,
      actor,
      prospectIds: body.prospectIds,
      limit: body.limit,
      industries: body.industries?.length ? body.industries : undefined,
    }));
  }

  if (action === "build_campaign") {
    return NextResponse.json(await buildCampaignPackagesForStormEvent(eventId, { supabase, actor, industries: body.industries }));
  }

  if (action === "create_storm_campaign") {
    return NextResponse.json(await createOverdriveCampaignPackagesForStormEvent(eventId, {
      supabase,
      actor,
      industries: body.industries?.length ? body.industries : STORMREACH_OVERDRIVE_SERVICE_CATEGORIES.slice(0, 4),
    }));
  }

  if (action === "generate_storm_image") {
    return NextResponse.json(await createStormReachAutopilotAssetsForStormEvent(eventId, {
      supabase,
      actor,
      limit: body.assetLimit ?? 4,
    }));
  }

  if (action === "create_autopilot_campaign") {
    return NextResponse.json(await createStormReachAutopilotCampaign(eventId, { supabase, actor }));
  }

  if (action === "approve_outreach" || action === "reject_outreach") {
    if (!body.messageId) return NextResponse.json({ ok: false, error: "messageId is required." }, { status: 400 });
    const approvalStatus = action === "approve_outreach" ? "approved" : "rejected";
    const status = action === "approve_outreach" ? "approved" : "archived";
    const { error } = await supabase.from("storm_outreach_messages").update({
      approval_status: approvalStatus,
      status,
      updated_at: new Date().toISOString(),
    }).eq("id", body.messageId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, messageId: body.messageId, approvalStatus, sent: false });
  }

  if (action === "send_outreach") {
    if (!body.messageId) return NextResponse.json({ ok: false, error: "messageId is required." }, { status: 400 });
    const { data: message, error } = await supabase
      .from("storm_outreach_messages")
      .select("*")
      .eq("id", body.messageId)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    if (!message) return NextResponse.json({ ok: false, error: "StormReach outreach message not found." }, { status: 404 });

    const channel = String(message.channel ?? "email");
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const sentTodayResult = await supabase
      .from("storm_outreach_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", startOfDay.toISOString());
    const policy = evaluateStormReachSendPolicy({
      channel,
      sendMode: "manual_admin",
      recipientEmail: message.recipient_email,
      recipientPhone: message.recipient_phone,
      approvalStatus: message.approval_status,
      suppressionStatus: message.suppression_status,
      status: message.status,
      sendsToday: sentTodayResult.count ?? 0,
      dailyLimit: stormReachDailySendLimit(),
    });
    if (!policy.allowed) {
      return NextResponse.json({ ok: false, error: policy.reasons.join(" "), reasons: policy.reasons }, { status: 412 });
    }

    const subject = String(message.subject ?? "StormReach opportunity");
    const bodyText = String(message.body ?? "");
    const metadata = asObject(message.metadata);
    const sendResult = channel === "sms"
      ? await sendSms({
        to: toE164(String(message.recipient_phone ?? "")),
        body: bodyText,
        intent: "prospecting",
      })
      : await sendEmail({
        to: String(message.recipient_email ?? ""),
        subject,
        html: `<div style="font-family: Arial, sans-serif; max-width: 640px; color: #172033; line-height: 1.5;">${escapeHtml(bodyText).replace(/\n/g, "<br>")}</div>`,
        text: bodyText,
        intent: "prospecting",
        tags: ["stormreach"],
        metadata: {
          sr_msg_id: String(message.id).slice(0, 80),
          sr_event_id: String(message.storm_event_id ?? "").slice(0, 80),
          sender: String(message.sender_key ?? "jason").slice(0, 80),
        },
      });

    const now = new Date().toISOString();
    const nextStatus = sendResult.success ? "sent" : "failed";
    const { error: updateError } = await supabase.from("storm_outreach_messages").update({
      status: nextStatus,
      provider_message_id: sendResult.externalId ?? null,
      sent_at: sendResult.success ? now : message.sent_at ?? null,
      metadata: {
        ...metadata,
        send_provider: sendResult.provider ?? null,
          send_error: sendResult.success ? null : sendResult.error ?? "Unknown provider error.",
          send_test_mode: sendResult.testMode ?? false,
          send_mode: "manual_admin",
          sent_by: actor.id ?? actor.label ?? "stormreach_admin",
          sent_at: sendResult.success ? now : null,
        },
      updated_at: now,
    }).eq("id", body.messageId);
    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });

    await supabase.from("storm_audit_logs").insert({
      storm_event_id: message.storm_event_id ?? null,
      related_table: "storm_outreach_messages",
      related_id: String(message.id),
      actor_user_id: actor.id ?? null,
      actor_label: actor.label ?? actor.email ?? "stormreach_admin",
      action: sendResult.success ? "outreach_sent" : "outreach_send_failed",
      status: nextStatus,
      summary: sendResult.success
        ? `StormReach ${channel} message sent after human approval.`
        : `StormReach ${channel} send failed: ${sendResult.error ?? "Unknown provider error."}`,
      approval_status: String(message.approval_status ?? "approved"),
      details: {
        channel,
        provider: sendResult.provider ?? null,
        provider_message_id: sendResult.externalId ?? null,
        test_mode: sendResult.testMode ?? false,
        no_facebook_auto_send: true,
      },
    });

    return NextResponse.json({
      ok: sendResult.success,
      sent: sendResult.success,
      status: nextStatus,
      messageId: body.messageId,
      provider: sendResult.provider,
      providerMessageId: sendResult.externalId,
      error: sendResult.error ?? null,
    }, { status: sendResult.success ? 200 : 502 });
  }

  if (action === "approve_package") {
    if (!body.packageId) return NextResponse.json({ ok: false, error: "packageId is required." }, { status: 400 });
    const { error } = await supabase.from("storm_marketing_packages").update({
      approval_status: "approved",
      status: "approved",
      updated_at: new Date().toISOString(),
    }).eq("id", body.packageId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, packageId: body.packageId, approvalStatus: "approved", launched: false });
  }

  if (action === "archive" || action === "dismiss") {
    return NextResponse.json(await updateStormEventStatus(eventId, action === "archive" ? "archived" : "dismissed", { supabase, actor }));
  }

  if (action === "update_status" && body.status) {
    return NextResponse.json(await updateStormEventStatus(eventId, body.status, { supabase, actor }));
  }

  if (action === "send_now" || action === "schedule_send" || action === "bulk_send") {
    return NextResponse.json(
      {
        ok: false,
        error: "StormReach send actions are disabled by default. Approve drafts first, confirm suppression handling, and enable an explicit provider workflow before sending.",
        approvalRequired: true,
      },
      { status: 412 },
    );
  }

  return NextResponse.json({ ok: false, error: `Unsupported StormReach action: ${action}` }, { status: 400 });
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toE164(value: string) {
  const phone = normalizePhone(value);
  return phone.length === 10 ? `+1${phone}` : value.trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
