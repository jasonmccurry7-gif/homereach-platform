import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

const AttributionEventSchema = z.object({
  eventName: z.enum(["page_view", "lead_submit", "quote_start", "proposal_request", "call_click", "payment_start", "payment_complete"]),
  sessionId: z.string().max(120).optional().nullable(),
  anonymousId: z.string().max(120).optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  salesLeadId: z.string().uuid().optional().nullable(),
  relatedRecordType: z.string().max(80).optional().nullable(),
  relatedRecordId: z.string().uuid().optional().nullable(),
  landingPath: z.string().max(500).optional().nullable(),
  pagePath: z.string().max(500).optional().nullable(),
  referrer: z.string().max(1000).optional().nullable(),
  source: z.string().max(120).optional().nullable(),
  medium: z.string().max(120).optional().nullable(),
  campaign: z.string().max(160).optional().nullable(),
  term: z.string().max(160).optional().nullable(),
  content: z.string().max(160).optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export async function POST(req: Request) {
  const limited = checkRateLimit(req, {
    key: "seo-attribution-events",
    limit: 180,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const parsed = AttributionEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid attribution event." }, { status: 400 });
  }

  const event = parsed.data;
  const supa = createServiceClient();
  const { error } = await supa.from("seo_attribution_events").insert({
    event_name: event.eventName,
    session_id: event.sessionId ?? null,
    anonymous_id: event.anonymousId ?? null,
    lead_id: event.leadId ?? null,
    sales_lead_id: event.salesLeadId ?? null,
    related_record_type: event.relatedRecordType ?? null,
    related_record_id: event.relatedRecordId ?? null,
    landing_path: normalizePath(event.landingPath),
    page_path: normalizePath(event.pagePath),
    referrer: event.referrer ?? null,
    source: event.source ?? inferSource(event.referrer),
    medium: event.medium ?? inferMedium(event.referrer),
    campaign: event.campaign ?? null,
    term: event.term ?? null,
    content: event.content ?? null,
    metadata: event.metadata,
  });

  if (error) {
    console.error("[seo-attribution/events]", error);
    return NextResponse.json({ ok: false, error: "Attribution event not recorded." }, { status: 500 });
  }

  await supa.from("seo_connector_statuses").upsert(
    {
      source_key: "analytics_attribution",
      label: "GA4 or Server Analytics",
      provider: "server_attribution_events",
      status: "connected",
      last_sync_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source_key" },
  );

  return NextResponse.json({ ok: true });
}

function normalizePath(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value, "https://home-reach.com").pathname;
  } catch {
    return value.startsWith("/") ? value : `/${value}`;
  }
}

function inferSource(referrer?: string | null) {
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (host.includes("google.")) return "google";
    if (host.includes("bing.")) return "bing";
    if (host.includes("facebook.") || host.includes("instagram.")) return "meta";
    if (host.includes("linkedin.")) return "linkedin";
    return host;
  } catch {
    return "referral";
  }
}

function inferMedium(referrer?: string | null) {
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname;
    if (host.includes("google.") || host.includes("bing.")) return "organic";
    return "referral";
  } catch {
    return "referral";
  }
}
