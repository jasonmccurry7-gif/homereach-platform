import { createServiceClient } from "@/lib/supabase/service";

type RevenueBusinessLine =
  | "targeted_mailing"
  | "inventory_procurement"
  | "political"
  | "unknown";

type RevenueChannel = "sms" | "email" | "facebook_dm" | "manual";

interface RecordOutboundRevenueMessageInput {
  businessLine?: RevenueBusinessLine;
  sourceSystem: string;
  sourceId: string | null;
  channel: RevenueChannel;
  body: string;
  to?: string | null;
  from?: string | null;
  subject?: string | null;
  provider?: string | null;
  providerMessageId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  displayName?: string | null;
  organizationName?: string | null;
  city?: string | null;
  category?: string | null;
  leadStatus?: string | null;
  assignedTo?: string | null;
  metadata?: Record<string, unknown>;
}

interface SupabaseErrorLike {
  message?: string;
  code?: string;
  details?: string;
}

interface ResolvedOutboundSubject {
  businessLine: RevenueBusinessLine;
  sourceSystem: string;
  sourceId: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  displayName?: string | null;
  organizationName?: string | null;
  city?: string | null;
  category?: string | null;
  leadStatus?: string | null;
  assignedTo?: string | null;
  metadata?: Record<string, unknown>;
}

function logBridgeWarning(message: string, error?: SupabaseErrorLike | null) {
  const detail = error?.message ?? error?.details ?? "";
  console.warn(`[revenue-messaging] ${message}${detail ? `: ${detail}` : ""}`);
}

async function resolveSalesLead(
  supabase: ReturnType<typeof createServiceClient>,
  input: RecordOutboundRevenueMessageInput,
): Promise<ResolvedOutboundSubject | null> {
  if (input.sourceSystem !== "sales_leads" || !input.sourceId) return null;

  const { data, error } = await supabase
    .from("sales_leads")
    .select("id, business_name, contact_name, email, phone, city, category, status, assigned_agent_id, do_not_contact, sms_opt_out")
    .eq("id", input.sourceId)
    .maybeSingle();

  if (error) {
    logBridgeWarning("sales lead outbound lookup skipped", error);
    return null;
  }
  if (!data) return null;

  return {
    businessLine: input.businessLine ?? "targeted_mailing",
    sourceSystem: "sales_leads",
    sourceId: data.id,
    contactName: input.contactName ?? data.contact_name,
    contactPhone: input.contactPhone ?? data.phone,
    contactEmail: input.contactEmail ?? data.email,
    displayName: input.displayName ?? data.business_name ?? data.contact_name,
    organizationName: input.organizationName ?? data.business_name,
    city: input.city ?? data.city,
    category: input.category ?? data.category,
    leadStatus: input.leadStatus ?? data.status,
    assignedTo: input.assignedTo ?? data.assigned_agent_id,
    metadata: {
      do_not_contact: data.do_not_contact,
      sms_opt_out: data.sms_opt_out,
      ...(input.metadata ?? {}),
    },
  };
}

async function resolveOutboundSubject(
  supabase: ReturnType<typeof createServiceClient>,
  input: RecordOutboundRevenueMessageInput,
): Promise<ResolvedOutboundSubject> {
  const salesLead = await resolveSalesLead(supabase, input);
  if (salesLead) return salesLead;

  return {
    businessLine: input.businessLine ?? "unknown",
    sourceSystem: input.sourceSystem,
    sourceId: input.sourceId,
    contactName: input.contactName ?? null,
    contactPhone: input.contactPhone ?? (input.channel === "sms" ? input.to ?? null : null),
    contactEmail: input.contactEmail ?? (input.channel === "email" ? input.to ?? null : null),
    displayName: input.displayName ?? input.organizationName ?? input.contactName ?? input.to ?? null,
    organizationName: input.organizationName ?? null,
    city: input.city ?? null,
    category: input.category ?? null,
    leadStatus: input.leadStatus ?? null,
    assignedTo: input.assignedTo ?? null,
    metadata: input.metadata ?? {},
  };
}

async function upsertThread(
  supabase: ReturnType<typeof createServiceClient>,
  subject: ResolvedOutboundSubject,
  input: RecordOutboundRevenueMessageInput,
): Promise<string | null> {
  if (!subject.sourceId) return null;

  const threadPayload = {
    business_line: subject.businessLine,
    source_system: subject.sourceSystem,
    source_id: subject.sourceId,
    channel: input.channel,
    contact_name: subject.contactName ?? null,
    contact_phone: subject.contactPhone ?? null,
    contact_email: subject.contactEmail ?? null,
    display_name: subject.displayName ?? subject.organizationName ?? subject.contactName ?? input.to ?? null,
    organization_name: subject.organizationName ?? null,
    city: subject.city ?? null,
    category: subject.category ?? null,
    status: "waiting_on_customer",
    lead_status: subject.leadStatus ?? null,
    assigned_to: subject.assignedTo ?? null,
    latest_message_body: input.body,
    latest_message_at: new Date().toISOString(),
    latest_direction: "outbound",
    metadata: {
      ...(subject.metadata ?? {}),
      provider: input.provider ?? null,
    },
  };

  const { data: existing } = await supabase
    .from("revenue_message_threads")
    .select("id, unread_count")
    .eq("business_line", subject.businessLine)
    .eq("source_system", subject.sourceSystem)
    .eq("source_id", subject.sourceId)
    .eq("channel", input.channel)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("revenue_message_threads")
      .update({
        ...threadPayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) logBridgeWarning("outbound thread update skipped", error);
    return existing.id;
  }

  const { data, error } = await supabase
    .from("revenue_message_threads")
    .insert({
      ...threadPayload,
      unread_count: 0,
      automation_mode: subject.businessLine === "political" ? "human_approval" : "human_approval",
      automation_paused: subject.businessLine === "political",
      pause_reason: subject.businessLine === "political" ? "political_outbound_requires_manual_handoff" : null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    logBridgeWarning("outbound thread insert skipped", error);
    return null;
  }

  return data?.id ?? null;
}

export async function recordOutboundRevenueMessage(input: RecordOutboundRevenueMessageInput) {
  if (process.env.REVENUE_MESSAGING_BRIDGE_ENABLED === "false") {
    return { recorded: false, reason: "feature_flag_off" };
  }

  const supabase = createServiceClient();
  const subject = await resolveOutboundSubject(supabase, input);
  const threadId = await upsertThread(supabase, subject, input);

  const { data, error } = await supabase
    .from("revenue_message_events")
    .insert({
      thread_id: threadId,
      business_line: subject.businessLine,
      source_system: subject.sourceSystem,
      source_id: subject.sourceId,
      provider: input.provider ?? null,
      provider_message_id: input.providerMessageId ?? null,
      channel: input.channel,
      direction: "outbound",
      event_type: "message",
      normalized_from: input.from ?? null,
      normalized_to: input.to ?? null,
      contact_name: subject.contactName ?? null,
      contact_phone: subject.contactPhone ?? null,
      contact_email: subject.contactEmail ?? null,
      subject: input.subject ?? null,
      message_body: input.body,
      processing_status: "processed",
      raw_payload: {},
      metadata: {
        ...(subject.metadata ?? {}),
        ...(input.metadata ?? {}),
      },
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code !== "23505") logBridgeWarning("outbound event insert skipped", error);
    return { recorded: false, reason: error.code === "23505" ? "duplicate_provider_message" : "insert_failed" };
  }

  return { recorded: true, threadId, eventId: data?.id ?? null };
}
