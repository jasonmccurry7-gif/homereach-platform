import { createServiceClient } from "@/lib/supabase/service";

type RevenueBusinessLine =
  | "targeted_mailing"
  | "inventory_procurement"
  | "political"
  | "unknown";

type RevenueChannel = "sms" | "email";

interface InboundMessageInput {
  channel: RevenueChannel;
  from: string;
  to?: string | null;
  body: string;
  provider: "twilio" | "postmark" | "mailgun" | "resend" | "manual";
  providerMessageId?: string | null;
  rawPayload?: Record<string, unknown>;
}

interface ResolvedSubject {
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

interface SupabaseErrorLike {
  message?: string;
  code?: string;
  details?: string;
}

function logBridgeWarning(message: string, error?: SupabaseErrorLike | null) {
  const detail = error?.message ?? error?.details ?? "";
  console.warn(`[revenue-messaging] ${message}${detail ? `: ${detail}` : ""}`);
}

function getSystemAlertPhone(): string {
  return process.env.SYSTEM_ALERT_PHONE ?? process.env.OWNER_CELL_PHONE ?? "+13302069639";
}

function phoneVariants(value: string | null | undefined): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  const variants = new Set<string>([trimmed]);

  if (digits.length === 10) {
    variants.add(`+1${digits}`);
    variants.add(digits);
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    variants.add(`+${digits}`);
    variants.add(digits);
    variants.add(digits.slice(1));
  }

  return Array.from(variants).filter(Boolean);
}

async function findPoliticalOutreachLead(
  supabase: ReturnType<typeof createServiceClient>,
  variants: string[]
): Promise<ResolvedSubject | null> {
  if (variants.length === 0) return null;

  const { data, error } = await supabase
    .from("political_outreach_leads")
    .select("id, contact_name, contact_email, contact_phone, candidate_name, office_sought, organization_name, state, geography_value, status, assigned_to, do_not_contact")
    .in("contact_phone", variants)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    logBridgeWarning("political outreach lookup skipped", error);
    return null;
  }

  const lead = data?.[0];
  if (!lead) return null;

  return {
    businessLine: "political",
    sourceSystem: "political_outreach_leads",
    sourceId: lead.id,
    contactName: lead.contact_name,
    contactPhone: lead.contact_phone,
    contactEmail: lead.contact_email,
    displayName: lead.candidate_name ?? lead.organization_name ?? lead.contact_name,
    organizationName: lead.organization_name,
    city: lead.geography_value,
    category: lead.office_sought,
    leadStatus: lead.status,
    assignedTo: lead.assigned_to,
    metadata: {
      candidate_name: lead.candidate_name,
      office_sought: lead.office_sought,
      state: lead.state,
      do_not_contact: lead.do_not_contact,
    },
  };
}

async function findPoliticalCampaignContact(
  supabase: ReturnType<typeof createServiceClient>,
  variants: string[]
): Promise<ResolvedSubject | null> {
  if (variants.length === 0) return null;

  const { data, error } = await supabase
    .from("political_campaign_contacts")
    .select("id, campaign_candidate_id, campaign_id, name, role, email, phone, do_not_contact, do_not_text")
    .in("phone", variants)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    logBridgeWarning("political contact lookup skipped", error);
    return null;
  }

  const contact = data?.[0];
  if (!contact) return null;

  const { data: candidate } = await supabase
    .from("campaign_candidates")
    .select("candidate_name, office_sought, state, district, county, city, status")
    .eq("id", contact.campaign_candidate_id)
    .maybeSingle();

  return {
    businessLine: "political",
    sourceSystem: "political_campaign_contacts",
    sourceId: contact.id,
    contactName: contact.name,
    contactPhone: contact.phone,
    contactEmail: contact.email,
    displayName: candidate?.candidate_name ?? contact.name,
    organizationName: candidate?.candidate_name ?? null,
    city: candidate?.city ?? candidate?.county ?? candidate?.district ?? null,
    category: candidate?.office_sought ?? contact.role ?? null,
    leadStatus: candidate?.status ?? null,
    metadata: {
      campaign_candidate_id: contact.campaign_candidate_id,
      political_campaign_id: contact.campaign_id,
      role: contact.role,
      candidate_name: candidate?.candidate_name,
      office_sought: candidate?.office_sought,
      state: candidate?.state,
      do_not_contact: contact.do_not_contact,
      do_not_text: contact.do_not_text,
    },
  };
}

async function findSalesLead(
  supabase: ReturnType<typeof createServiceClient>,
  variants: string[]
): Promise<ResolvedSubject | null> {
  if (variants.length === 0) return null;

  const { data, error } = await supabase
    .from("sales_leads")
    .select("id, business_name, contact_name, email, phone, city, category, status, assigned_agent_id, do_not_contact, sms_opt_out")
    .in("phone", variants)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    logBridgeWarning("sales lead lookup skipped", error);
    return null;
  }

  const lead = data?.[0];
  if (!lead) return null;

  return {
    businessLine: "targeted_mailing",
    sourceSystem: "sales_leads",
    sourceId: lead.id,
    contactName: lead.contact_name,
    contactPhone: lead.phone,
    contactEmail: lead.email,
    displayName: lead.business_name,
    organizationName: lead.business_name,
    city: lead.city,
    category: lead.category,
    leadStatus: lead.status,
    assignedTo: lead.assigned_agent_id,
    metadata: {
      do_not_contact: lead.do_not_contact,
      sms_opt_out: lead.sms_opt_out,
    },
  };
}

async function findTargetedLead(
  supabase: ReturnType<typeof createServiceClient>,
  variants: string[]
): Promise<ResolvedSubject | null> {
  if (variants.length === 0) return null;

  const { data, error } = await supabase
    .from("leads")
    .select("id, name, business_name, phone, email, city, source, status")
    .in("phone", variants)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    logBridgeWarning("targeted lead lookup skipped", error);
    return null;
  }

  const lead = data?.[0];
  if (!lead) return null;

  return {
    businessLine: "targeted_mailing",
    sourceSystem: "leads",
    sourceId: lead.id,
    contactName: lead.name,
    contactPhone: lead.phone,
    contactEmail: lead.email,
    displayName: lead.business_name ?? lead.name,
    organizationName: lead.business_name,
    city: lead.city,
    leadStatus: lead.status,
    metadata: {
      source: lead.source,
    },
  };
}

async function resolveSubject(
  supabase: ReturnType<typeof createServiceClient>,
  input: InboundMessageInput
): Promise<ResolvedSubject> {
  const variants = phoneVariants(input.channel === "sms" ? input.from : null);

  const politicalOutreachLead = await findPoliticalOutreachLead(supabase, variants);
  if (politicalOutreachLead) return politicalOutreachLead;

  const politicalContact = await findPoliticalCampaignContact(supabase, variants);
  if (politicalContact) return politicalContact;

  const salesLead = await findSalesLead(supabase, variants);
  if (salesLead) return salesLead;

  const targetedLead = await findTargetedLead(supabase, variants);
  if (targetedLead) return targetedLead;

  return {
    businessLine: "unknown",
    sourceSystem: "unmatched_inbound",
    sourceId: null,
    contactPhone: input.channel === "sms" ? input.from : null,
    displayName: input.from,
    metadata: {
      resolution: "no_matching_lead_or_contact",
    },
  };
}

async function upsertThread(
  supabase: ReturnType<typeof createServiceClient>,
  subject: ResolvedSubject,
  input: InboundMessageInput
): Promise<string | null> {
  if (!subject.sourceId) return null;

  const threadPayload = {
    business_line: subject.businessLine,
    source_system: subject.sourceSystem,
    source_id: subject.sourceId,
    channel: input.channel,
    contact_name: subject.contactName ?? null,
    contact_phone: subject.contactPhone ?? (input.channel === "sms" ? input.from : null),
    contact_email: subject.contactEmail ?? null,
    display_name: subject.displayName ?? subject.organizationName ?? subject.contactName ?? input.from,
    organization_name: subject.organizationName ?? null,
    city: subject.city ?? null,
    category: subject.category ?? null,
    status: subject.businessLine === "political" ? "waiting_on_homereach" : "open",
    lead_status: subject.leadStatus ?? null,
    assigned_to: subject.assignedTo ?? null,
    latest_message_body: input.body,
    latest_message_at: new Date().toISOString(),
    latest_direction: "inbound",
    unread_count: 1,
    automation_mode: subject.businessLine === "political" ? "human_approval" : "human_approval",
    automation_paused: subject.businessLine === "political",
    pause_reason: subject.businessLine === "political" ? "political_response_handoff" : null,
    metadata: {
      ...(subject.metadata ?? {}),
      provider: input.provider,
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
        unread_count: (existing.unread_count ?? 0) + 1,
      })
      .eq("id", existing.id);

    if (error) {
      logBridgeWarning("thread update skipped", error);
      return existing.id;
    }

    return existing.id;
  }

  const { data, error } = await supabase
    .from("revenue_message_threads")
    .insert(threadPayload)
    .select("id")
    .maybeSingle();

  if (error) {
    logBridgeWarning("thread insert skipped", error);
    return null;
  }

  return data?.id ?? null;
}

async function insertMessageEvent(
  supabase: ReturnType<typeof createServiceClient>,
  threadId: string | null,
  subject: ResolvedSubject,
  input: InboundMessageInput
): Promise<string | null> {
  const { data, error } = await supabase
    .from("revenue_message_events")
    .insert({
      thread_id: threadId,
      business_line: subject.businessLine,
      source_system: subject.sourceSystem,
      source_id: subject.sourceId,
      provider: input.provider,
      provider_message_id: input.providerMessageId ?? null,
      webhook_event_id: input.providerMessageId ?? null,
      channel: input.channel,
      direction: "inbound",
      event_type: "message",
      normalized_from: input.from,
      normalized_to: input.to ?? null,
      contact_name: subject.contactName ?? null,
      contact_phone: subject.contactPhone ?? (input.channel === "sms" ? input.from : null),
      contact_email: subject.contactEmail ?? null,
      message_body: input.body,
      processing_status: "processed",
      raw_payload: input.rawPayload ?? {},
      metadata: subject.metadata ?? {},
    })
    .select("id")
    .maybeSingle();

  if (error) {
    logBridgeWarning("event insert skipped", error);
    return null;
  }

  return data?.id ?? null;
}

async function logWebhookEvent(
  supabase: ReturnType<typeof createServiceClient>,
  input: InboundMessageInput
) {
  const { error } = await supabase.from("revenue_webhook_events").insert({
    provider: input.provider,
    event_type: `${input.channel}_inbound`,
    provider_event_id: input.providerMessageId ?? null,
    processing_status: "processed",
    payload: input.rawPayload ?? {},
  });

  if (error) logBridgeWarning("webhook event log skipped", error);
}

async function updateSalesVisibility(
  supabase: ReturnType<typeof createServiceClient>,
  subject: ResolvedSubject,
  input: InboundMessageInput
) {
  if (subject.sourceSystem !== "sales_leads" || !subject.sourceId) return;

  const now = new Date().toISOString();
  await supabase.from("sales_events").insert({
    lead_id: subject.sourceId,
    agent_id: subject.assignedTo ?? null,
    action_type: "reply_received",
    channel: input.channel,
    city: subject.city ?? null,
    category: subject.category ?? null,
    message: input.body,
    metadata: {
      provider: input.provider,
      provider_message_id: input.providerMessageId,
      revenue_messaging_bridge: true,
    },
  });

  const { data: lead } = await supabase
    .from("sales_leads")
    .select("total_replies")
    .eq("id", subject.sourceId)
    .maybeSingle();

  await supabase
    .from("sales_leads")
    .update({
      status: "replied",
      last_reply_at: now,
      total_replies: (lead?.total_replies ?? 0) + 1,
      updated_at: now,
    })
    .eq("id", subject.sourceId);
}

async function createAiSuggestion(
  supabase: ReturnType<typeof createServiceClient>,
  threadId: string | null,
  eventId: string | null,
  subject: ResolvedSubject
) {
  if (!threadId) return;

  const isPolitical = subject.businessLine === "political";
  const { error } = await supabase.from("revenue_ai_suggestions").insert({
    thread_id: threadId,
    event_id: eventId,
    business_line: subject.businessLine,
    suggestion_type: isPolitical ? "manual_handoff" : "reply",
    status: "needs_review",
    automation_mode: "human_approval",
    recommended_action: isPolitical
      ? "Jason should personally review and reply. Political automation is paused for this thread."
      : "Review the reply, qualify interest, and send the next approved intake/booking step if appropriate.",
    suggested_body: null,
    confidence: isPolitical ? 0.95 : 0.7,
    safety_notes: isPolitical
      ? "Political reply captured. No automated response was sent."
      : "Draft-only until automation safeguards are explicitly enabled.",
    metadata: subject.metadata ?? {},
  });

  if (error) logBridgeWarning("AI suggestion insert skipped", error);
}

async function queueApprovalItem(
  supabase: ReturnType<typeof createServiceClient>,
  threadId: string | null,
  subject: ResolvedSubject,
  input: InboundMessageInput
) {
  if (!threadId) return;

  const title =
    subject.businessLine === "political"
      ? `Political reply waiting: ${subject.displayName ?? subject.contactName ?? input.from}`
      : `Inbound reply waiting: ${subject.displayName ?? subject.contactName ?? input.from}`;

  const { error } = await supabase.from("revenue_message_approval_queue").insert({
    thread_id: threadId,
    business_line: subject.businessLine,
    channel: input.channel,
    status: "needs_review",
    title,
    message_body: input.body,
    assigned_to: subject.assignedTo ?? null,
    due_at: new Date().toISOString(),
    metadata: {
      source_system: subject.sourceSystem,
      source_id: subject.sourceId,
      provider: input.provider,
      provider_message_id: input.providerMessageId,
    },
  });

  if (error) logBridgeWarning("approval queue insert skipped", error);
}

async function handlePoliticalHandoff(
  supabase: ReturnType<typeof createServiceClient>,
  subject: ResolvedSubject,
  input: InboundMessageInput,
  threadId: string | null
) {
  if (subject.businessLine !== "political") return;

  if (subject.sourceSystem === "political_outreach_leads" && subject.sourceId) {
    await supabase.from("political_follow_ups").insert({
      outreach_lead_id: subject.sourceId,
      channel: "internal_note",
      trigger: "lead_inbound",
      payload: {
        source: "revenue_messaging_engine",
        channel: input.channel,
        from: input.from,
        message: input.body,
        thread_id: threadId,
        required_action: "Jason manual follow-up",
      },
      scheduled_for: new Date().toISOString(),
      status: "pending",
      assigned_to: subject.assignedTo ?? null,
    });

    await supabase
      .from("political_outreach_leads")
      .update({
        next_follow_up_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subject.sourceId);
  }

  await supabase.from("sales_events").insert({
    action_type: "reply_received",
    channel: input.channel,
    message: input.body,
    metadata: {
      provider: input.provider,
      provider_message_id: input.providerMessageId,
      business_line: "political",
      source_system: subject.sourceSystem,
      source_id: subject.sourceId,
      candidate_name: subject.metadata?.candidate_name,
      office_sought: subject.metadata?.office_sought,
      revenue_messaging_bridge: true,
      automation_paused: true,
    },
  });

  await logJasonPoliticalAlert(supabase, subject, input, threadId);
}

async function logJasonPoliticalAlert(
  supabase: ReturnType<typeof createServiceClient>,
  subject: ResolvedSubject,
  input: InboundMessageInput,
  threadId: string | null
) {
  const candidateName =
    typeof subject.metadata?.candidate_name === "string"
      ? subject.metadata.candidate_name
      : subject.displayName ?? "Political lead";
  const office =
    typeof subject.metadata?.office_sought === "string"
      ? subject.metadata.office_sought
      : subject.category ?? "campaign";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com";
  const systemAlertPhone = getSystemAlertPhone();
  const deepLink = `${appUrl}/admin/political/outreach`;
  const preview = input.body.length > 140 ? `${input.body.slice(0, 137)}...` : input.body;
  const message = [
    `Political reply: ${candidateName} (${office})`,
    `From: ${subject.contactName ?? input.from}`,
    preview,
    deepLink,
  ].join("\n");

  await supabase.from("revenue_webhook_events").insert({
    provider: "revenue_messaging_engine",
    event_type: "political_response_handoff",
    provider_event_id: input.providerMessageId ?? null,
    processing_status: "processed",
    payload: {
      thread_id: threadId,
      candidate_name: candidateName,
      office,
      from: input.from,
      message_preview: preview,
      notification_target: "jason",
    },
  });

  const { data: alertRecord, error: alertInsertError } = await supabase
    .from("internal_alerts")
    .insert({
      agent_id: subject.assignedTo ?? null,
      lead_id: null,
      business_name: candidateName,
      city: subject.city ?? null,
      alert_type: "reply_waiting",
      urgency: "high",
      message,
      phone: systemAlertPhone,
      status: "queued",
      deep_link: deepLink,
      dedupe_key: `political_reply_${subject.sourceSystem}_${subject.sourceId ?? input.providerMessageId ?? Date.now()}`,
      metadata: {
        revenue_message_thread_id: threadId,
        source_system: subject.sourceSystem,
        source_id: subject.sourceId,
        channel: input.channel,
        provider: input.provider,
        provider_message_id: input.providerMessageId,
        log_only: process.env.REVENUE_MESSAGING_POLITICAL_RESPONSE_SMS_ENABLED !== "true",
      },
    })
    .select("id")
    .maybeSingle();

  if (alertInsertError) logBridgeWarning("internal alert record skipped", alertInsertError);

  if (
    process.env.ENABLE_INTERNAL_ALERTS === "true" &&
    process.env.REVENUE_MESSAGING_POLITICAL_RESPONSE_SMS_ENABLED === "true"
  ) {
    try {
      const { sendSms } = await import("@homereach/services/outreach");
      const result = await sendSms({ to: systemAlertPhone, body: message });
      if (!result.success) {
        logBridgeWarning("political response SMS alert failed", { message: result.error });
        if (alertRecord?.id) {
          await supabase
            .from("internal_alerts")
            .update({ status: "failed", reason: result.error ?? "send_failed" })
            .eq("id", alertRecord.id);
        }
      } else if (alertRecord?.id) {
        await supabase
          .from("internal_alerts")
          .update({
            status: "sent",
            twilio_sid: result.externalId ?? null,
            sent_at: new Date().toISOString(),
          })
          .eq("id", alertRecord.id);
      }
    } catch (error) {
      logBridgeWarning("political response SMS alert threw", {
        message: error instanceof Error ? error.message : String(error),
      });
      if (alertRecord?.id) {
        await supabase
          .from("internal_alerts")
          .update({
            status: "failed",
            reason: error instanceof Error ? error.message : String(error),
          })
          .eq("id", alertRecord.id);
      }
    }
  }
}

export async function processInboundRevenueMessage(input: InboundMessageInput) {
  if (process.env.REVENUE_MESSAGING_BRIDGE_ENABLED === "false") {
    return { processed: false, reason: "feature_flag_off" };
  }

  const supabase = createServiceClient();
  const subject = await resolveSubject(supabase, input);

  await logWebhookEvent(supabase, input);

  const threadId = await upsertThread(supabase, subject, input);
  const eventId = await insertMessageEvent(supabase, threadId, subject, input);

  await updateSalesVisibility(supabase, subject, input);
  await handlePoliticalHandoff(supabase, subject, input, threadId);
  await createAiSuggestion(supabase, threadId, eventId, subject);
  await queueApprovalItem(supabase, threadId, subject, input);

  return {
    processed: true,
    businessLine: subject.businessLine,
    sourceSystem: subject.sourceSystem,
    sourceId: subject.sourceId,
    threadId,
    eventId,
  };
}
