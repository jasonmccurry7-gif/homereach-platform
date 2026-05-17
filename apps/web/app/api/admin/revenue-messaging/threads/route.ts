import { NextResponse } from "next/server";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const BUSINESS_LINES = new Set([
  "targeted_mailing",
  "inventory_procurement",
  "political",
  "unknown",
]);

const THREAD_STATUSES = new Set([
  "open",
  "needs_review",
  "waiting_on_customer",
  "waiting_on_homereach",
  "paused",
  "closed",
  "archived",
]);

function parseLimit(value: string | null) {
  const parsed = Number(value ?? "100");
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(Math.max(Math.trunc(parsed), 1), 250);
}

export async function GET(req: Request) {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  const supabase = createServiceClient();
  const { searchParams } = new URL(req.url);
  const businessLine = searchParams.get("business_line");
  const status = searchParams.get("status");
  const limit = parseLimit(searchParams.get("limit"));

  let threadQuery = supabase
    .from("revenue_message_threads")
    .select("*")
    .order("latest_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (businessLine && BUSINESS_LINES.has(businessLine)) {
    threadQuery = threadQuery.eq("business_line", businessLine);
  }

  if (status && THREAD_STATUSES.has(status)) {
    threadQuery = threadQuery.eq("status", status);
  }

  const { data: threads, error: threadError } = await threadQuery;

  if (threadError) {
    if (threadError.code === "42P01") {
      return NextResponse.json({
        threads: [],
        setupRequired: true,
        message: "Run migration 093_revenue_messaging_engine.sql to enable Revenue Messaging Engine visibility.",
      });
    }

    return NextResponse.json({ error: threadError.message }, { status: 500 });
  }

  const threadIds = (threads ?? []).map((thread) => thread.id);
  if (threadIds.length === 0) {
    return NextResponse.json({ threads: [] });
  }

  const [{ data: events }, { data: suggestions }, { data: approvals }] = await Promise.all([
    supabase
      .from("revenue_message_events")
      .select("id, thread_id, created_at, channel, direction, event_type, provider, provider_message_id, contact_name, contact_phone, contact_email, subject, message_body, processing_status, metadata")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("revenue_ai_suggestions")
      .select("id, thread_id, event_id, created_at, status, suggestion_type, recommended_action, suggested_body, confidence, safety_notes")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("revenue_message_approval_queue")
      .select("id, thread_id, created_at, status, title, channel, message_body, assigned_to, due_at, metadata")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false }),
  ]);

  const eventsByThread = new Map<string, unknown[]>();
  for (const event of events ?? []) {
    const key = event.thread_id as string;
    const list = eventsByThread.get(key) ?? [];
    list.push(event);
    eventsByThread.set(key, list);
  }

  const suggestionsByThread = new Map<string, unknown[]>();
  for (const suggestion of suggestions ?? []) {
    const key = suggestion.thread_id as string;
    const list = suggestionsByThread.get(key) ?? [];
    list.push(suggestion);
    suggestionsByThread.set(key, list);
  }

  const approvalsByThread = new Map<string, unknown[]>();
  for (const approval of approvals ?? []) {
    const key = approval.thread_id as string;
    const list = approvalsByThread.get(key) ?? [];
    list.push(approval);
    approvalsByThread.set(key, list);
  }

  return NextResponse.json({
    threads: (threads ?? []).map((thread) => ({
      ...thread,
      events: eventsByThread.get(thread.id) ?? [],
      ai_suggestions: suggestionsByThread.get(thread.id) ?? [],
      approval_items: approvalsByThread.get(thread.id) ?? [],
    })),
  });
}
