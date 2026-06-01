import { NextResponse } from "next/server";
import { buildOwnerSignature } from "@homereach/services/outreach";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { syncRevenueApprovalLedger } from "@/lib/approvals/revenue-approval-ledger";
import {
  HOMEREACH_PERSONAS,
  communicationPolicyMetadata,
  personaTemplateVars,
  selectPoliticalSenderPersona,
  type HomeReachPersona,
} from "@/lib/revenue-messaging/personas";
import { createServiceClient } from "@/lib/supabase/service";

type BusinessLine = "targeted_mailing" | "inventory_procurement" | "political" | "unknown";
type Channel = "email" | "sms" | "facebook_dm" | "manual";
type SourceType = "sales_lead" | "campaign_candidate" | "manual";

type DraftRequest = {
  sourceType?: SourceType;
  sourceId?: string;
  businessLine?: BusinessLine;
  channel?: Channel;
  mode?: "dm" | "email" | "sms" | "social_research" | "browser_assist" | "rewrite";
  displayName?: string;
  city?: string | null;
  category?: string | null;
  email?: string | null;
  phone?: string | null;
  facebookUrl?: string | null;
  messengerUrl?: string | null;
  websiteUrl?: string | null;
};

function resolvePublicAppUrl() {
  const candidates = [
    process.env.OUTBOUND_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    "https://www.home-reach.com",
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
        return url.toString().replace(/\/+$/, "");
      }
    } catch {
      continue;
    }
  }
  return "https://www.home-reach.com";
}

const PUBLIC_APP_URL = resolvePublicAppUrl();

const JASON_POLITICAL_EMAIL = "jason@home-reach.com";

function isChannel(value: unknown): value is Channel {
  return value === "email" || value === "sms" || value === "facebook_dm" || value === "manual";
}

function isBusinessLine(value: unknown): value is BusinessLine {
  return value === "targeted_mailing" || value === "inventory_procurement" || value === "political" || value === "unknown";
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeUrl(value: unknown) {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeEmail(value: unknown) {
  const email = clean(value)?.toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizePhone(value: unknown) {
  const phone = clean(value);
  if (!phone) return null;
  return phone.replace(/[^\d+]/g, "");
}

function inferBusinessLine(input: DraftRequest, loaded: Record<string, unknown> | null): BusinessLine {
  if (isBusinessLine(input.businessLine)) return input.businessLine;
  if (input.sourceType === "campaign_candidate") return "political";
  const haystack = [
    input.displayName,
    input.category,
    loaded?.business_name,
    loaded?.category,
    loaded?.candidate_name,
    loaded?.office_sought,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/candidate|campaign|governor|senate|mayor|council|political|attorney general|auditor|treasurer/.test(haystack)) {
    return "political";
  }
  if (/procurement|inventory|supplier|vendor|restaurant|bakery|food|pizza|supplies|cost/.test(haystack)) {
    return "inventory_procurement";
  }
  return "targeted_mailing";
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function selectDraftPersona(input: {
  businessLine: BusinessLine;
  sourceId: string | null;
  displayName: string;
  category: string | null;
  loaded: Record<string, unknown> | null;
}) {
  if (input.businessLine === "political") {
    const selected = selectPoliticalSenderPersona({
      id: input.sourceId,
      candidateName: clean(input.loaded?.candidate_name) ?? input.displayName,
      officeSought: clean(input.loaded?.office_sought) ?? input.category,
      geographyType: clean(input.loaded?.geography_type),
      districtType: clean(input.loaded?.district_type) ?? clean(input.loaded?.race_level),
      priorityScore: numberOrNull(input.loaded?.priority_score),
    });
    return selected.key === "jason" ? selected : HOMEREACH_PERSONAS.jason;
  }
  if (input.businessLine === "inventory_procurement") return HOMEREACH_PERSONAS.heather;
  return HOMEREACH_PERSONAS.josh;
}

function signatureForPersona(persona: HomeReachPersona) {
  if (persona.key === "jason") return buildOwnerSignature().replace(/jason@home-reach\.com/gi, JASON_POLITICAL_EMAIL);
  return persona.signoffs[0] ?? persona.name;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function politicalCandidateSlug(input: {
  displayName: string;
  loaded: Record<string, unknown> | null;
}) {
  const candidateName = clean(input.loaded?.candidate_name) ?? input.displayName;
  const normalized = `${candidateName} ${input.displayName}`.toLowerCase();
  if (normalized.includes("amy") && normalized.includes("acton")) return "amy-acton";
  return slugify(candidateName) || "amy-acton";
}

function politicalOptionsImageUrl(slug: string) {
  const url = new URL("/api/political/candidate-options-image", PUBLIC_APP_URL);
  url.searchParams.set("candidate", slug);
  return url.toString();
}

function politicalReviewUrl(slug: string) {
  const url = new URL("/political", PUBLIC_APP_URL);
  url.searchParams.set("candidate", slug);
  url.searchParams.set("utm_source", "political_email");
  url.searchParams.set("utm_medium", "email");
  url.hash = "campaign-options";
  return url.toString();
}

function emailSubjectFor(input: { businessLine: BusinessLine; displayName: string }) {
  if (input.businessLine === "political") return `${input.displayName} mail plan options ready`;
  if (input.businessLine === "inventory_procurement") return `${input.displayName} supplier cost review`;
  return `${input.displayName} local growth snapshot`;
}

function draftFor(input: {
  businessLine: BusinessLine;
  displayName: string;
  city: string | null;
  category: string | null;
  mode: string;
  persona: HomeReachPersona;
  seed: string;
  politicalOptionsImageUrl: string | null;
  politicalReviewUrl: string | null;
}) {
  const city = input.city ?? "your market";
  const category = input.category ?? "your team";
  const personaVars = personaTemplateVars(input.persona, {
    seed: input.seed,
    candidateName: input.businessLine === "political" ? input.displayName : null,
    businessName: input.businessLine !== "political" ? input.displayName : null,
  });
  const signoff = signatureForPersona(input.persona);

  if (input.mode === "social_research") {
    return [
      `Social research brief for ${input.displayName}`,
      "",
      `Review public Facebook/page activity, website context, recent posts, visible offers, response signals, and local market fit in ${city}.`,
      "Return: lead score, outreach angle, recommended HomeReach offer, recommended CTA, platform risk, and next human action.",
      "",
      "Human review required before any outbound message.",
    ].join("\n");
  }
  if (input.mode === "browser_assist") {
    return [
      `Browser Assist workflow prepared for ${input.displayName}.`,
      "",
      "Open the public page/profile, verify the prospect, review recent visible context, then use the approved draft only if it still fits.",
      "Do not send automatically. Operator keeps final control.",
    ].join("\n");
  }
  if (input.businessLine === "political") {
    const includePoliticalScreenshot = input.mode === "email" && input.politicalOptionsImageUrl;
    const includePoliticalReviewLink = input.mode === "email" && input.politicalReviewUrl;
    return [
      `Hi ${input.displayName} team,`,
      "",
      `I'm ${input.persona.name.split(" ")[0]} with HomeReach. ${personaVars.persona_opening_line}`,
      "",
      personaVars.persona_value_line,
      "",
      includePoliticalScreenshot ? "Four-option campaign mail snapshot:" : null,
      includePoliticalScreenshot
        ? `[[image:${input.politicalOptionsImageUrl}|${input.displayName} four campaign mail options]]`
        : null,
      includePoliticalScreenshot ? "" : null,
      "The point is to make the mail decision visible: geography, timing, voter reach, and execution path before anyone commits production time.",
      "",
      personaVars.persona_cta,
      "",
      includePoliticalReviewLink ? "Review link:" : null,
      includePoliticalReviewLink ? input.politicalReviewUrl : null,
      includePoliticalReviewLink ? "" : null,
      signoff,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
  }
  if (input.businessLine === "inventory_procurement") {
    return [
      `Hi ${input.displayName},`,
      "",
      personaVars.persona_opening_line,
      "",
      personaVars.persona_value_line,
      "",
      personaVars.persona_cta,
      "",
      signoff,
    ].join("\n");
  }
  return [
    `Hi ${input.displayName},`,
    "",
    `I noticed your ${category} business in ${city} and thought HomeReach may be able to help you get more local visibility without adding another complicated marketing system.`,
    "",
    "We help local businesses reach the right neighborhoods through AI-assisted outreach, postcard campaigns, and follow-up visibility.",
    "",
    "Would a quick local growth snapshot be useful?",
    "",
    signoff,
  ].join("\n");
}

async function loadSource(input: DraftRequest) {
  if (!input.sourceId || input.sourceType === "manual") return null;
  const db = createServiceClient();
  if (input.sourceType === "campaign_candidate") {
    const { data } = await db
      .from("campaign_candidates")
      .select("id,candidate_name,office_sought,state,geography_type,geography_value,district_type,race_level,priority_score,party_optional_public,campaign_website,campaign_email,campaign_phone,facebook_url,messenger_url,campaign_manager_name,campaign_manager_email,do_not_contact,do_not_email,do_not_text")
      .eq("id", input.sourceId)
      .maybeSingle();
    return (data ?? null) as Record<string, unknown> | null;
  }
  const { data } = await db
    .from("sales_leads")
    .select("*")
    .eq("id", input.sourceId)
    .maybeSingle();
  return (data ?? null) as Record<string, unknown> | null;
}

export async function POST(request: Request) {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  const input = (await request.json().catch(() => ({}))) as DraftRequest;
  const sourceType = input.sourceType ?? "manual";
  const sourceId = clean(input.sourceId);
  const requestedChannel = isChannel(input.channel) ? input.channel : "facebook_dm";
  let channel = requestedChannel;
  const mode = input.mode ?? "dm";
  const loaded = await loadSource({ ...input, sourceType, sourceId: sourceId ?? undefined });

  if (loaded?.do_not_contact || (channel === "email" && loaded?.do_not_email) || (channel === "sms" && loaded?.do_not_text)) {
    return NextResponse.json({ ok: false, error: "This record is marked do-not-contact for the selected channel." }, { status: 409 });
  }

  const businessLine = inferBusinessLine(input, loaded);
  const displayName =
    clean(input.displayName) ??
    clean(loaded?.business_name) ??
    clean(loaded?.candidate_name) ??
    "HomeReach prospect";
  const city = clean(input.city) ?? clean(loaded?.city) ?? clean(loaded?.geography_value);
  const category = clean(input.category) ?? clean(loaded?.category) ?? clean(loaded?.office_sought);
  const email = normalizeEmail(input.email) ?? normalizeEmail(loaded?.email) ?? normalizeEmail(loaded?.campaign_email) ?? normalizeEmail(loaded?.campaign_manager_email);
  const phone = normalizePhone(input.phone) ?? normalizePhone(loaded?.phone) ?? normalizePhone(loaded?.campaign_phone);
  const facebookUrl = safeUrl(input.facebookUrl) ?? safeUrl(loaded?.facebook_url);
  const messengerUrl = safeUrl(input.messengerUrl) ?? safeUrl(loaded?.messenger_url);
  const websiteUrl = safeUrl(input.websiteUrl) ?? safeUrl(loaded?.website_url) ?? safeUrl(loaded?.website) ?? safeUrl(loaded?.campaign_website);
  const browserUrl = mode === "browser_assist" ? facebookUrl ?? messengerUrl ?? websiteUrl : null;
  const missingSocialTarget = requestedChannel === "facebook_dm" && !facebookUrl && !messengerUrl;
  const candidateSlug = businessLine === "political" ? politicalCandidateSlug({ displayName, loaded }) : null;
  const politicalImageUrl = candidateSlug ? politicalOptionsImageUrl(candidateSlug) : null;
  const politicalPlanUrl = candidateSlug ? politicalReviewUrl(candidateSlug) : null;

  if (missingSocialTarget) {
    channel = "manual";
  }

  if (businessLine === "political" && channel === "email") {
    if (guard.user?.app_metadata?.user_role !== "admin") {
      return NextResponse.json({ ok: false, error: "Political email drafts require an admin operator." }, { status: 403 });
    }
    if (sourceType !== "campaign_candidate" || !sourceId || !loaded) {
      return NextResponse.json({
        ok: false,
        error: "Political email drafts must be linked to a saved campaign candidate record.",
      }, { status: 400 });
    }
  }

  if (channel === "email" && !email) {
    return NextResponse.json({ ok: false, error: "Missing recipient email." }, { status: 400 });
  }
  if (channel === "sms" && !phone) {
    return NextResponse.json({ ok: false, error: "Missing recipient phone." }, { status: 400 });
  }
  if (channel === "facebook_dm" && !facebookUrl && !messengerUrl) {
    return NextResponse.json({ ok: false, error: "Missing Facebook or Messenger URL." }, { status: 400 });
  }

  const persona = selectDraftPersona({
    businessLine,
    sourceId,
    displayName,
    category,
    loaded,
  });
  const messageBody = draftFor({
    businessLine,
    displayName,
    city,
    category,
    mode,
    persona,
    seed: `${sourceType}:${sourceId ?? displayName}:${channel}:${mode}`,
    politicalOptionsImageUrl: politicalImageUrl,
    politicalReviewUrl: politicalPlanUrl,
  });
  const outboundEmailSubject = channel === "email" ? emailSubjectFor({ businessLine, displayName }) : null;
  const title =
    mode === "social_research"
      ? `${displayName} social research brief`
      : mode === "browser_assist"
        ? `${displayName} browser-assisted outreach workflow`
        : outboundEmailSubject ?? `${displayName} ${channel.replace("_", " ")} draft`;

  const db = createServiceClient();
  const senderEmail =
    businessLine === "political" ? JASON_POLITICAL_EMAIL : persona.email;
  const senderName =
    businessLine === "political" ? HOMEREACH_PERSONAS.jason.name : persona.name;

  if (businessLine === "political" && channel === "email") {
    const { data: senderIdentity, error: senderIdentityError } = await db
      .from("agent_identities")
      .select("agent_id,is_active,from_email")
      .ilike("from_email", JASON_POLITICAL_EMAIL)
      .maybeSingle<{ agent_id: string | null; is_active: boolean | null; from_email: string | null }>();

    if (senderIdentityError) {
      return NextResponse.json({ ok: false, error: senderIdentityError.message }, { status: 500 });
    }
    if (!senderIdentity?.agent_id || senderIdentity.is_active === false) {
      return NextResponse.json({
        ok: false,
        error: "Jason HomeReach email identity is missing or inactive. Verify agent_identities before queueing political email.",
      }, { status: 409 });
    }
  }

  const metadata = {
    workflow: "multi_channel_social_outreach",
    source_system: sourceType,
    source_id: sourceId,
    display_name: displayName,
    organization_name: displayName,
    candidate_slug: candidateSlug,
    business_line: businessLine,
    city,
    category,
    contact_email: email,
    contact_phone: phone,
    to_email: email,
    to_phone: phone,
    requested_channel: requestedChannel,
    resolved_channel: channel,
    facebook_url: facebookUrl,
    messenger_url: messengerUrl,
    website_url: websiteUrl,
    browser_assist_url: browserUrl,
    political_options_image_url: politicalImageUrl,
    political_plan_url: politicalPlanUrl,
    visual_asset_type: politicalImageUrl ? "four_option_campaign_screenshot" : null,
    image_render_contract: politicalImageUrl ? "inline_image_token" : null,
    mode,
    missing_social_profile: missingSocialTarget,
    fallback_reason: missingSocialTarget ? "facebook_dm_missing_social_url_queued_as_manual_review" : null,
    subject: outboundEmailSubject,
    sender_email: senderEmail,
    from_email: senderEmail,
    sender_name: senderName,
    reply_to: senderEmail,
    ...communicationPolicyMetadata(persona),
    human_approval_required: true,
    manual_send_only: businessLine === "political" && channel === "email",
    requires_manual_send: businessLine === "political" && channel === "email",
    auto_send_disabled: businessLine === "political" && channel === "email",
    requires_political_options_image: businessLine === "political" && channel === "email",
    approval_status: "needs_review",
    next_action:
      businessLine === "political" && channel === "email"
        ? "admin_review_then_explicit_manual_send"
        : "admin_review_before_outbound_action",
    destination: "revenue_message_approval_queue",
    inputs_used: [
      "outreach_command_subject",
      sourceType,
      sourceId ? `${sourceType}:${sourceId}` : "manual_input",
      businessLine,
    ],
    sources_referenced: [
      sourceType === "campaign_candidate" ? "campaign_candidates" : sourceType,
      politicalImageUrl ? "political_candidate_options_image_endpoint" : null,
      politicalPlanUrl ? "political_campaign_options_page" : null,
    ].filter(Boolean),
    approval_required_reason:
      channel === "email"
        ? "human_review_required_before_outbound_email_send"
        : "human_review_required_before_outbound_or_public_action",
    platform_risk: requestedChannel === "facebook_dm" ? "manual_or_meta_permission_required" : "standard_approval_required",
  };

  const { data, error } = await db
    .from("revenue_message_approval_queue")
    .insert({
      business_line: businessLine,
      channel,
      status: "needs_review",
      title,
      message_body: messageBody,
      requested_by: "multi_channel_outreach_command_center",
      assigned_to: guard.user?.id ?? null,
      metadata,
    })
    .select("id,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const ledgerResult = await syncRevenueApprovalLedger(
    {
      id: data.id,
      businessLine,
      channel,
      status: "needs_review",
      title,
      messageBody,
      metadata,
      requestedBy: guard.user?.id ?? null,
      assignedTo: guard.user?.id ?? null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
    {
      actorId: guard.user?.id ?? null,
      actorLabel: guard.user?.email ?? "admin",
      eventType: "revenue_approval_created",
    },
  );
  if (!ledgerResult.ok && ledgerResult.error) {
    console.warn("[approval-ledger] social outreach draft sync skipped:", ledgerResult.error);
  }

  await logPlatformAuditEvent({
    actorType: "human",
    actorId: guard.user?.id ?? null,
    actorLabel: guard.user?.email ?? "admin",
    module: "multi_channel_outreach",
    actionType: mode === "browser_assist" ? "browser_assist_queued" : "social_outreach_draft_queued",
    entityType: "revenue_message_approval_queue",
    entityId: data.id,
    sourceTable: sourceType,
    sourceId,
    channel,
    provider: requestedChannel === "facebook_dm" ? "facebook_manual_or_meta" : "manual",
    resultStatus: "success",
    approvalState: "needs_review",
    severity: "info",
    message: `${title} queued for human review.`,
    metadata,
  });

  return NextResponse.json({
    ok: true,
    approvalId: data.id,
    title,
    messageBody,
    browserUrl,
    senderEmail,
    politicalOptionsImageUrl: politicalImageUrl,
    politicalPlanUrl,
  });
}
