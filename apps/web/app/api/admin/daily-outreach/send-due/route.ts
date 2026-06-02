import { NextRequest, NextResponse } from "next/server";
import { extractRequestSecret, requireAdminOrCron } from "@/lib/auth/api-guards";
import {
  generateDailyOutreach,
  logOutreachActivity,
  queueDailyOutreachEmail,
  todayKey,
} from "@/lib/daily-outreach/server";
import type { DailyOutreachTask } from "@/lib/daily-outreach/types";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ROUTE_VERSION = "daily-outreach-reconciliation-v2";

function easternBusinessWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const minutes = hour * 60 + minute;
  return {
    weekday,
    minutes,
    allowed: !["Sat", "Sun"].includes(weekday) && minutes >= 510 && minutes <= 990,
  };
}

function requestHeadersForSend(req: NextRequest) {
  const headers = new Headers({ "content-type": "application/json" });
  const authorization = req.headers.get("authorization");
  const cookie = req.headers.get("cookie");
  const cronSecret = req.headers.get("x-cron-secret") ?? process.env.CRON_SECRET ?? "";
  if (authorization) headers.set("authorization", authorization);
  if (cookie) headers.set("cookie", cookie);
  if (cronSecret) {
    headers.set("authorization", `Bearer ${cronSecret}`);
    headers.set("x-cron-secret", cronSecret);
  }
  return headers;
}

async function handleSendDue(req: NextRequest, allowMutation: boolean) {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const supabase = createServiceClient();
  const url = new URL(req.url);
  const dryRun = !allowMutation || url.searchParams.get("dryRun") === "1" || url.searchParams.get("status") === "1";
  const date = url.searchParams.get("date") ?? todayKey();
  const limit = Math.max(1, Math.min(10, Number(url.searchParams.get("limit") ?? 2)));
  const window = easternBusinessWindow();

  if (!window.allowed && process.env.AUTO_SEND_REQUIRE_BUSINESS_HOURS !== "false") {
    return NextResponse.json({
      ok: true,
      routeVersion: ROUTE_VERSION,
      mode: "outside_window",
      date,
      queuedForReview: 0,
      approvedForSend: 0,
      approvalMismatches: 0,
      sendResult: null,
      window,
      message: "Daily outreach send-due is inside weekday 8:30 AM-4:30 PM ET only.",
    });
  }

  if (!dryRun) {
    try {
      await generateDailyOutreach(date, guard.user?.id ?? null);
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Unable to generate daily outreach safely." },
        { status: 503 },
      );
    }
  }

  const [
    { data: controls, error: controlsError },
    { data: campaignControls, error: campaignControlsError },
    { data: tasks, error },
  ] = await Promise.all([
    supabase
      .from("system_controls")
      .select("all_paused,email_paused,outreach_test_mode,manual_approval_mode,email_domain_authentication_verified,postmark_sender_signatures_verified")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("daily_outreach_campaign_controls")
      .select("campaign_type,paused,manual_approval_required,daily_cap"),
    supabase
      .from("daily_outreach_tasks")
      .select("*")
      .eq("outreach_date", date)
      .not("email", "is", null)
      .in("send_status", ["draft", "queued_for_review", "approved_pending_send", "failed"])
      .lte("scheduled_send_at", new Date().toISOString())
      .order("scheduled_send_at", { ascending: true })
      .limit(limit * 3),
  ]);

  if (controlsError) return NextResponse.json({ ok: false, error: controlsError.message }, { status: 503 });
  if (campaignControlsError) return NextResponse.json({ ok: false, error: campaignControlsError.message }, { status: 503 });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const taskRows = ((tasks ?? []) as DailyOutreachTask[]).slice(0, limit);
  const linkedApprovalIds = Array.from(
    new Set(
      taskRows
        .map((task) => task.approval_queue_id)
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    ),
  );
  const approvalStatusById = new Map<string, string | null>();
  if (linkedApprovalIds.length > 0) {
    const { data: linkedApprovals, error: linkedApprovalError } = await supabase
      .from("revenue_message_approval_queue")
      .select("id,status")
      .in("id", linkedApprovalIds);
    if (linkedApprovalError) return NextResponse.json({ ok: false, error: linkedApprovalError.message }, { status: 503 });
    for (const approval of linkedApprovals ?? []) {
      approvalStatusById.set(String(approval.id), typeof approval.status === "string" ? approval.status : null);
    }
  }

  const verified =
    controls?.email_domain_authentication_verified === true &&
    controls?.postmark_sender_signatures_verified === true &&
    controls?.outreach_test_mode !== true &&
    controls?.manual_approval_mode !== true;
  const paused = controls?.all_paused || controls?.email_paused;
  const campaigns = new Map(
    ((campaignControls ?? []) as Array<{ campaign_type: string; paused?: boolean; manual_approval_required?: boolean }>).map((control) => [
      control.campaign_type,
      control,
    ])
  );

  let queuedForReview = 0;
  let approvedForSend = 0;
  let failedToQueue = 0;
  let approvalMismatches = 0;
  const considered: string[] = [];

  for (const task of taskRows) {
    if ((task.send_attempts ?? 0) > 1) continue;
    const campaign = campaigns.get(String(task.campaign_type ?? ""));
    if (paused || campaign?.paused) continue;
    considered.push(task.id);

    const sendStatus = String(task.send_status ?? "draft").toLowerCase();
    if (sendStatus === "approved_pending_send") {
      const linkedApprovalStatus = task.approval_queue_id ? approvalStatusById.get(task.approval_queue_id) ?? null : null;
      const taskApprovalStatus = String(task.approval_status ?? "").toLowerCase();
      if (taskApprovalStatus !== "approved" || linkedApprovalStatus !== "approved") {
        approvalMismatches += 1;
        if (!dryRun) {
          await logOutreachActivity(supabase, {
            actorId: guard.user?.id ?? null,
            outreachDate: date,
            taskId: task.id,
            prospectId: task.prospect_id,
            category: task.category,
            activityType: "daily_outreach_approval_mismatch_blocked",
            channel: "email",
            status: "blocked",
            summary: "Skipped an approved-pending-send task because its approval queue row is not approved.",
            metadata: {
              sender_email: task.sender_email,
              campaign_type: task.campaign_type,
              send_status: task.send_status,
              approval_status: task.approval_status,
              approval_queue_id: task.approval_queue_id,
              linked_approval_status: linkedApprovalStatus,
            },
          });
        }
        continue;
      }
      approvedForSend += 1;
      continue;
    }

    const mustReview =
      !verified ||
      task.manual_approval_required !== false ||
      campaign?.manual_approval_required !== false;

    if (dryRun) {
      if (mustReview) queuedForReview += 1;
      else approvedForSend += 1;
      continue;
    }

    try {
      await queueDailyOutreachEmail(
        task.id,
        mustReview ? "queue_review" : "approve_send",
        guard.user?.id ?? null
      );
      if (mustReview) queuedForReview += 1;
      else approvedForSend += 1;
    } catch (err) {
      failedToQueue += 1;
      await logOutreachActivity(supabase, {
        actorId: guard.user?.id ?? null,
        outreachDate: date,
        taskId: task.id,
        prospectId: task.prospect_id,
        category: task.category,
        activityType: "daily_outreach_send_due_item_blocked",
        channel: "email",
        status: "blocked",
        summary: err instanceof Error ? err.message : "Due outreach item could not be queued.",
        metadata: {
          sender_email: task.sender_email,
          campaign_type: task.campaign_type,
          send_status: task.send_status,
          approval_status: task.approval_status,
        },
      });
    }
  }

  let sendResult: unknown = null;
  if (!dryRun && approvedForSend > 0 && !paused) {
    const sendUrl = new URL("/api/admin/revenue-messaging/send-approved", req.url);
    sendUrl.searchParams.set("businessLines", "targeted_mailing,political,inventory_procurement");
    sendUrl.searchParams.set("limit", String(Math.min(approvedForSend, limit)));
    const response = await fetch(sendUrl, {
      method: "GET",
      headers: requestHeadersForSend(req),
      cache: "no-store",
    });
    sendResult = await response.json().catch(() => ({ ok: false, error: "Unable to parse send result" }));
  }

  if (!dryRun || url.searchParams.get("logPreview") === "1") {
    await logOutreachActivity(supabase, {
      actorId: guard.user?.id ?? null,
      outreachDate: date,
      activityType: dryRun ? "daily_outreach_send_due_previewed" : "daily_outreach_send_due_processed",
      channel: "email",
      status: failedToQueue > 0 ? "partial" : "logged",
      summary: dryRun
        ? `Previewed ${considered.length} due outreach email items.`
        : `Processed due outreach: ${queuedForReview} queued for review, ${approvedForSend} approved, ${failedToQueue} blocked, ${approvalMismatches} approval mismatches skipped.`,
      metadata: {
        considered,
        queued_for_review: queuedForReview,
        approved_for_send: approvedForSend,
        failed_to_queue: failedToQueue,
        approval_mismatches: approvalMismatches,
        verified,
        paused: Boolean(paused),
        dry_run: dryRun,
        window,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    routeVersion: ROUTE_VERSION,
    mode: dryRun ? "preview" : "processed",
    date,
    verified,
    paused: Boolean(paused),
    considered,
    queuedForReview,
    approvedForSend,
    failedToQueue,
    approvalMismatches,
    sendResult,
  });
}

export async function GET(req: NextRequest) {
  const cronSecret = extractRequestSecret(req);
  const isCronInvocation = Boolean(process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET);
  return handleSendDue(req, isCronInvocation);
}

export async function POST(req: NextRequest) {
  return handleSendDue(req, true);
}
