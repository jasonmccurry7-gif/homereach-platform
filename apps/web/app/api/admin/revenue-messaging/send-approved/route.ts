import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ApprovalMetadata = Record<string, unknown>;

type ApprovalCandidate = {
  id: string;
  business_line: string | null;
  channel: string | null;
  status: string | null;
  title: string | null;
  due_at?: string | null;
  metadata: ApprovalMetadata | null;
};

function parseList(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLimit(value: string | null | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), 25);
}

function metadataObject(value: unknown): ApprovalMetadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ApprovalMetadata)
    : {};
}

function metadataFlag(metadata: ApprovalMetadata, key: string) {
  const value = metadata[key];
  return value === true || String(value ?? "").toLowerCase() === "true";
}

function isWithinEasternSendWindow(now = new Date()) {
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
  const weekdayOk = !["Sat", "Sun"].includes(weekday);
  return weekdayOk && minutes >= 510 && minutes <= 990;
}

function requestHeadersForSend(req: NextRequest) {
  const headers = new Headers({ "content-type": "application/json" });
  const authorization = req.headers.get("authorization");
  const cronSecret = req.headers.get("x-cron-secret") ?? process.env.CRON_SECRET ?? "";
  const cookie = req.headers.get("cookie");

  if (authorization) headers.set("authorization", authorization);
  if (cronSecret) {
    headers.set("authorization", `Bearer ${cronSecret}`);
    headers.set("x-cron-secret", cronSecret);
  }
  if (cookie) headers.set("cookie", cookie);

  return headers;
}

async function handleSendApproved(req: NextRequest) {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const statusOnly = url.searchParams.get("status") === "1";
  const dryRun = statusOnly || url.searchParams.get("dryRun") === "1";
  const sendWindowRequired = process.env.AUTO_SEND_REQUIRE_BUSINESS_HOURS !== "false";
  const inWindow = isWithinEasternSendWindow();

  const requestedBusinessLines = parseList(
    url.searchParams.get("businessLines") ?? process.env.AUTO_SEND_APPROVED_BUSINESS_LINES,
  );
  const businessLines =
    requestedBusinessLines.length > 0
      ? requestedBusinessLines
      : ["targeted_mailing", "political", "inventory_procurement"];
  const limit = parseLimit(
    url.searchParams.get("limit") ?? process.env.AUTO_SEND_APPROVED_EMAIL_LIMIT,
    3,
  );

  const supabase = createServiceClient();
  const { data: controls, error: controlsError } = await supabase
    .from("system_controls")
    .select("all_paused,email_paused,outreach_test_mode")
    .eq("id", 1)
    .maybeSingle();
  if (controlsError) {
    return NextResponse.json({ ok: false, error: controlsError.message }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("revenue_message_approval_queue")
    .select("id,business_line,channel,status,title,due_at,metadata,created_at")
    .eq("channel", "email")
    .eq("status", "approved")
    .in("business_line", businessLines)
    .order("created_at", { ascending: true })
    .limit(limit * 3);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const approved = ((data ?? []) as ApprovalCandidate[]).filter((approval) => {
    const metadata = metadataObject(approval.metadata);
    const dueAt = approval.due_at ? new Date(approval.due_at).getTime() : null;
    const explicitDailyOutreachSend =
      metadata.source_system === "daily_outreach_tasks" &&
      typeof metadata.daily_outreach_task_id === "string" &&
      metadata.daily_outreach_task_id.trim().length > 0 &&
      metadataFlag(metadata, "auto_send_enabled");
    const isPolitical = approval.business_line === "political";
    const politicalAutoSendAllowed =
      metadataFlag(metadata, "autonomous_send_allowed") ||
      metadataFlag(metadata, "release_to_auto_send");
    return !(
      (isPolitical && !politicalAutoSendAllowed) ||
      !explicitDailyOutreachSend ||
      metadataFlag(metadata, "auto_send_disabled") ||
      metadataFlag(metadata, "requires_manual_send") ||
      metadataFlag(metadata, "manual_send_only") ||
      (dueAt !== null && dueAt > Date.now())
    );
  });
  const selected = approved.slice(0, limit);

  if (dryRun || controls?.all_paused || controls?.email_paused || (sendWindowRequired && !inWindow)) {
    return NextResponse.json({
      ok: true,
      mode: dryRun ? "status" : "paused",
      selectedCount: selected.length,
      approvedCount: approved.length,
      businessLines,
      limit,
      sendWindowRequired,
      inWindow,
      blockedBy: controls?.all_paused
        ? "Global outbound pause is enabled."
        : controls?.email_paused
          ? "Email channel pause is enabled."
          : sendWindowRequired && !inWindow
            ? "Outside approved weekday 8:30 AM-4:30 PM ET send window."
            : null,
      candidates: selected.map((approval) => ({
        id: approval.id,
        title: approval.title,
        businessLine: approval.business_line,
      })),
    });
  }

  const headers = requestHeadersForSend(req);
  const results: Array<{
    id: string;
    ok: boolean;
    status: number;
    message?: string;
    error?: string;
  }> = [];

  for (const approval of selected) {
    const sendUrl = new URL(
      `/api/admin/revenue-messaging/approvals/${approval.id}/send`,
      req.url,
    );
    const response = await fetch(sendUrl, {
      method: "POST",
      headers,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    results.push({
      id: approval.id,
      ok: response.ok && payload.ok !== false,
      status: response.status,
      message: typeof payload.message === "string" ? payload.message : undefined,
      error:
        typeof payload.error === "string"
          ? payload.error
          : response.ok
            ? undefined
            : "Send request failed.",
    });
  }

  return NextResponse.json({
    ok: results.every((result) => result.ok),
    sent: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    approvedCount: approved.length,
    selectedCount: selected.length,
    businessLines,
    limit,
    testMode: Boolean(controls?.outreach_test_mode),
    results,
  });
}

export async function GET(req: NextRequest) {
  return handleSendApproved(req);
}

export async function POST(req: NextRequest) {
  return handleSendApproved(req);
}
