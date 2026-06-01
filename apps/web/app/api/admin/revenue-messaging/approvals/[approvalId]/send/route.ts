import { NextRequest, NextResponse } from "next/server";
import {
  appendEmailComplianceHtml,
  appendEmailComplianceText,
  getEmailRotationPool,
  getOwnerIdentity,
  sendEmail,
  type EmailAttachment,
} from "@homereach/services/outreach";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { syncRevenueApprovalLedger } from "@/lib/approvals/revenue-approval-ledger";
import { recordOutboundRevenueMessage } from "@/lib/revenue-messaging/outbound";
import { auditDeliverabilityCopy } from "@/lib/sales-engine/outreach-governance";
import { visualForSenderDraft } from "@/lib/daily-outreach/drafts";
import type { DailyOutreachSenderKey, OutreachCategory } from "@/lib/daily-outreach/types";
import {
  evaluateOutboundReputation,
  logReputationDecision,
} from "@/lib/deliverability/reputation-control";

type ApprovalMetadata = Record<string, unknown>;

type ApprovalRow = {
  id: string;
  thread_id: string | null;
  business_line: "targeted_mailing" | "inventory_procurement" | "political" | "unknown";
  channel: string;
  status: string;
  title: string;
  message_body: string | null;
  metadata: ApprovalMetadata | null;
};

type AgentIdentity = {
  agent_id: string;
  from_email: string | null;
  from_name: string | null;
  reply_to_email: string | null;
  is_active: boolean | null;
};

type DailyOutreachVisualTask = {
  id: string;
  outreach_date: string;
  sender_key: DailyOutreachSenderKey | null;
  category: OutreachCategory;
  business_name: string | null;
  campaign_name: string | null;
  contact_name: string | null;
  industry: string | null;
  source_id: string | null;
  source_table: string | null;
  city: string | null;
  county: string | null;
  state: string | null;
  daily_sequence: number | null;
};

const BASE_ALLOWED_SENDER_EMAILS = [
  "josh@home-reach.com",
  "chelsi@home-reach.com",
  "heather@home-reach.com",
  "jason@home-reach.com",
];
const POLITICAL_REQUIRED_SENDER_EMAIL = "jason@home-reach.com";
const POLITICAL_REQUIRED_SENDER_NAME = "Jason McCurry";

const IMAGE_ATTACHMENT_LIMIT_BYTES = 3 * 1024 * 1024;

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

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
      if (!isLocalHostname(url.hostname)) return url.toString().replace(/\/+$/, "");
    } catch {
      continue;
    }
  }
  return "https://www.home-reach.com";
}

const PUBLIC_APP_URL = resolvePublicAppUrl();

function jsonError(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function metadataObject(value: unknown): ApprovalMetadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ApprovalMetadata)
    : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeEmail(value: string | null): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function isPlanStatusSendSafe(value: unknown) {
  return ["approved", "proposal_ready", "production_ready"].includes(
    String(value ?? "").toLowerCase(),
  );
}

function hasOwnerOverride(metadata: ApprovalMetadata) {
  return metadata.owner_override === true || metadata.political_send_override === true;
}

async function moveApprovalBackToReview(args: {
  supabase: ReturnType<typeof createServiceClient>;
  approval: ApprovalRow;
  metadata: ApprovalMetadata;
  reason: string;
  actorId?: string | null;
  actorLabel?: string | null;
  patch?: ApprovalMetadata;
}) {
  const nextMetadata = mergeMetadata(args.metadata, {
    last_send_blocked_at: new Date().toISOString(),
    last_send_blocked_reason: args.reason,
    ...(args.patch ?? {}),
  });
  await args.supabase
    .from("revenue_message_approval_queue")
    .update({
      status: "needs_review",
      updated_at: new Date().toISOString(),
      metadata: nextMetadata,
    })
    .eq("id", args.approval.id);

  const ledgerResult = await syncRevenueApprovalLedger(
    {
      id: args.approval.id,
      businessLine: args.approval.business_line,
      channel: args.approval.channel,
      status: "needs_review",
      title: args.approval.title,
      messageBody: args.approval.message_body,
      metadata: nextMetadata,
      threadId: args.approval.thread_id,
      updatedAt: new Date().toISOString(),
    },
    {
      actorId: args.actorId ?? null,
      actorLabel: args.actorLabel ?? "revenue_send_guardrail",
      eventType: "revenue_approval_needs_review",
      eventNotes: args.reason,
    },
  );
  if (!ledgerResult.ok && ledgerResult.error) {
    console.warn("[approval-ledger] send rollback sync skipped:", ledgerResult.error);
  }
}

async function politicalSuppressionBlockReason(args: {
  supabase: ReturnType<typeof createServiceClient>;
  metadata: ApprovalMetadata;
  toEmail: string;
}) {
  const candidateId = firstString(args.metadata.candidate_id, args.metadata.source_id);
  if (!candidateId) return null;

  const { data: candidate, error: candidateError } = await args.supabase
    .from("campaign_candidates")
    .select("id,candidate_status,do_not_contact,do_not_email,campaign_email,campaign_manager_email")
    .eq("id", candidateId)
    .maybeSingle<{
      id: string;
      candidate_status: string | null;
      do_not_contact: boolean | null;
      do_not_email: boolean | null;
      campaign_email: string | null;
      campaign_manager_email: string | null;
    }>();
  if (candidateError) throw candidateError;
  if (!candidate) return "Linked political candidate record no longer exists.";
  if (candidate.candidate_status && candidate.candidate_status.toLowerCase() !== "active") {
    return "Linked political candidate is no longer active.";
  }
  if (candidate.do_not_contact || candidate.do_not_email) {
    return "Linked political candidate is suppressed for email/contact.";
  }

  const { data: contact, error: contactError } = await args.supabase
    .from("political_campaign_contacts")
    .select("id,do_not_contact,do_not_email")
    .eq("campaign_candidate_id", candidateId)
    .ilike("email", args.toEmail)
    .maybeSingle<{ id: string; do_not_contact: boolean | null; do_not_email: boolean | null }>();
  if (contactError) throw contactError;
  if (contact?.do_not_contact || contact?.do_not_email) {
    return "Linked political contact is suppressed for email/contact.";
  }

  const candidateEmails = [
    normalizeEmail(candidate.campaign_email),
    normalizeEmail(candidate.campaign_manager_email),
  ].filter((email): email is string => Boolean(email));
  if (!contact && !candidateEmails.includes(args.toEmail)) {
    return "Recipient is no longer attached to the active political candidate record.";
  }

  return null;
}

function isSuppressedEmailStatus(value: unknown) {
  return ["bounced_permanent", "complained", "unsubscribed"].includes(
    String(value ?? "").toLowerCase(),
  );
}

async function emailSuppressionBlockReason(args: {
  supabase: ReturnType<typeof createServiceClient>;
  metadata: ApprovalMetadata;
  toEmail: string;
}) {
  const { data: suppressed, error: suppressionError } = await args.supabase
    .from("outreach_suppression_list")
    .select("reason")
    .eq("active", true)
    .in("channel", ["email", "all"])
    .ilike("contact_email", args.toEmail)
    .limit(1)
    .maybeSingle<{ reason: string | null }>();
  if (suppressionError) throw suppressionError;
  if (suppressed) return suppressed.reason ?? "Recipient is on the active outreach suppression list.";

  const sourceTable = firstString(args.metadata.prospect_source_table, args.metadata.source_table);
  const sourceId = firstString(args.metadata.prospect_source_id, args.metadata.source_record_id);
  if (!sourceTable || !sourceId) return null;

  if (sourceTable === "sales_leads") {
    const { data: lead, error } = await args.supabase
      .from("sales_leads")
      .select("id,email,do_not_contact,email_status")
      .eq("id", sourceId)
      .maybeSingle<{
        id: string;
        email: string | null;
        do_not_contact: boolean | null;
        email_status: string | null;
      }>();
    if (error) throw error;
    if (!lead) return "Linked sales lead no longer exists.";
    if (lead.do_not_contact) return "Linked sales lead is marked do_not_contact.";
    if (isSuppressedEmailStatus(lead.email_status)) return "Linked sales lead email is suppressed.";
    if (normalizeEmail(lead.email) !== args.toEmail) return "Recipient email no longer matches the linked sales lead.";
  }

  if (sourceTable === "outreach_prospects") {
    const { data: prospect, error } = await args.supabase
      .from("outreach_prospects")
      .select("id,email,status,opted_out_at")
      .eq("id", sourceId)
      .maybeSingle<{
        id: string;
        email: string | null;
        status: string | null;
        opted_out_at: string | null;
      }>();
    if (error) throw error;
    if (!prospect) return "Linked outreach prospect no longer exists.";
    if (prospect.opted_out_at) return "Linked outreach prospect has opted out.";
    if (["blocked", "dead", "do_not_contact", "suppressed"].includes(String(prospect.status ?? "").toLowerCase())) {
      return "Linked outreach prospect is suppressed.";
    }
    if (prospect.email && normalizeEmail(prospect.email) !== args.toEmail) {
      return "Recipient email no longer matches the linked outreach prospect.";
    }
  }

  return null;
}

async function dailyOutreachTaskBlockReason(args: {
  supabase: ReturnType<typeof createServiceClient>;
  taskId: string;
  toEmail: string;
}) {
  const { data: task, error } = await args.supabase
    .from("daily_outreach_tasks")
    .select("id,email,completed,send_status,approval_status,delivery_status")
    .eq("id", args.taskId)
    .maybeSingle<{
      id: string;
      email: string | null;
      completed: boolean | null;
      send_status: string | null;
      approval_status: string | null;
      delivery_status: string | null;
    }>();
  if (error) throw error;
  if (!task) return "Linked daily outreach task no longer exists.";
  if (normalizeEmail(task.email) !== args.toEmail) return "Recipient email no longer matches the linked daily outreach task.";
  if (task.completed) return "Linked daily outreach task is already completed.";
  if (["sent", "sending"].includes(String(task.send_status ?? "").toLowerCase())) {
    return "Linked daily outreach task is already sent or sending.";
  }
  if (["sent", "sending", "rejected"].includes(String(task.approval_status ?? "").toLowerCase())) {
    return "Linked daily outreach task approval state is terminal.";
  }
  if (["sent", "delivered", "bounced", "complained", "unsubscribed"].includes(String(task.delivery_status ?? "").toLowerCase())) {
    return "Linked daily outreach task delivery state is terminal.";
  }
  return null;
}

function outboundSourceSystem(metadata: ApprovalMetadata) {
  return firstString(metadata.prospect_source_table) ?? firstString(metadata.source_system) ?? "revenue_message_approval_queue";
}

function outboundSourceId(metadata: ApprovalMetadata, approvalId: string) {
  return firstString(metadata.prospect_source_id) ?? firstString(metadata.source_id, metadata.lead_id) ?? approvalId;
}

function outboundCategory(approval: ApprovalRow, metadata: ApprovalMetadata) {
  if (approval.business_line === "political") return "Political Campaign";
  if (approval.business_line === "inventory_procurement") return "Supplify Procurement";
  if (approval.business_line === "targeted_mailing") return "Targeted Mailing";
  return firstString(metadata.category) ?? "Daily Outreach";
}

function outboundTags(approval: ApprovalRow, metadata: ApprovalMetadata) {
  const tags = ["daily_outreach", approval.business_line];
  const campaignType = firstString(metadata.campaign_type);
  if (campaignType) tags.push(campaignType);
  return Array.from(new Set(tags));
}

async function markDailyOutreachSourceContacted(args: {
  supabase: ReturnType<typeof createServiceClient>;
  metadata: ApprovalMetadata;
  sentAt: string;
}) {
  const sourceTable = firstString(args.metadata.prospect_source_table, args.metadata.source_table);
  const sourceId = firstString(args.metadata.prospect_source_id, args.metadata.source_record_id);
  if (!sourceTable || !sourceId) return;

  try {
    if (sourceTable === "sales_leads") {
      await args.supabase
        .from("sales_leads")
        .update({ last_contacted_at: args.sentAt })
        .eq("id", sourceId);
    } else if (sourceTable === "outreach_prospects") {
      await args.supabase
        .from("outreach_prospects")
        .update({ last_contacted_at: args.sentAt, status: "contacted" })
        .eq("id", sourceId);
    } else if (sourceTable === "campaign_candidates") {
      await args.supabase
        .from("campaign_candidates")
        .update({ last_contacted_at: args.sentAt })
        .eq("id", sourceId);
    }
  } catch (error) {
    console.warn("[revenue-messaging] source contact update skipped", error);
  }
}

function allowedSenderEmails() {
  const owner = getOwnerIdentity();
  return new Set(
    [
      ...BASE_ALLOWED_SENDER_EMAILS,
      ...getEmailRotationPool(owner),
      owner.defaultFromEmail,
    ]
      .map((email) => normalizeEmail(email))
      .filter((email): email is string => Boolean(email)),
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeHttpUrl(value: string): boolean {
  if (!value || value.includes("{{")) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function publicPoliticalPlanUrl(candidate: string | null | undefined) {
  const url = new URL("/political", PUBLIC_APP_URL);
  if (candidate) url.searchParams.set("candidate", candidate);
  url.searchParams.set("utm_source", "political_email");
  url.searchParams.set("utm_medium", "email");
  url.hash = "campaign-options";
  return url.toString();
}

function normalizeOutboundUrl(value: string): string {
  if (!isSafeHttpUrl(value)) return value;
  try {
    const parsed = new URL(value);
    if (isLocalHostname(parsed.hostname)) {
      const outbound = new URL(PUBLIC_APP_URL);
      if (
        parsed.pathname === "/api/political/candidate-options-image" ||
        parsed.pathname.startsWith("/api/outreach-visuals/") ||
        parsed.pathname === "/political/candidate-agent" ||
        parsed.pathname === "/political"
      ) {
        outbound.pathname = parsed.pathname === "/political/candidate-agent" ? "/political" : parsed.pathname;
        outbound.search = parsed.search;
        outbound.hash = parsed.hash;
        return outbound.toString();
      }
    }

    const isHomeReach =
      parsed.hostname === "home-reach.com" ||
      parsed.hostname === "www.home-reach.com";
    if (!isHomeReach) return value;

    if (
      parsed.pathname === "/political/candidate-agent" ||
      parsed.pathname === "/political"
    ) {
      return publicPoliticalPlanUrl(parsed.searchParams.get("candidate"));
    }

    parsed.hostname = "www.home-reach.com";
    return parsed.toString();
  } catch {
    return value;
  }
}

function isApprovedInlineImageUrl(value: string) {
  if (!isSafeHttpUrl(value)) return false;
  try {
    const parsed = new URL(normalizeOutboundUrl(value));
    return parsed.hostname === "home-reach.com" || parsed.hostname === "www.home-reach.com";
  } catch {
    return false;
  }
}

function imageNameForUrl(value: string, index: number) {
  try {
    const parsed = new URL(value);
    const candidate = parsed.pathname.split("/").pop()?.replace(/[^a-zA-Z0-9._-]/g, "");
    if (candidate && /\.[a-z0-9]+$/i.test(candidate)) return candidate;
  } catch {
    // Use the stable fallback below.
  }
  return index === 0 ? "homereach-campaign-options.png" : `homereach-inline-image-${index + 1}.png`;
}

function contentTypeToExtension(contentType: string) {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("svg")) return "svg";
  return "png";
}

function extractImageTokenUrls(body: string) {
  const urls: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const imageMatch = line.trim().match(/^\[\[image:(.+?)(?:\|(.+?))?\]\]$/);
    const raw = imageMatch?.[1]?.trim();
    if (raw && isSafeHttpUrl(raw)) urls.push(normalizeOutboundUrl(raw));
  }
  return Array.from(new Set(urls));
}

async function buildInlineImageAttachments(body: string): Promise<{
  attachments: EmailAttachment[];
  inlineImages: Map<string, string>;
  errors: string[];
}> {
  const attachments: EmailAttachment[] = [];
  const inlineImages = new Map<string, string>();
  const errors: string[] = [];
  const urls = extractImageTokenUrls(body).filter(isApprovedInlineImageUrl);

  for (const [index, url] of urls.entries()) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { accept: "image/png,image/jpeg,image/webp,image/svg+xml,image/*" },
      });
      if (!response.ok) {
        errors.push(`${url} returned HTTP ${response.status}`);
        continue;
      }

      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
      if (!contentType.startsWith("image/")) {
        errors.push(`${url} returned ${contentType || "an unknown content type"}`);
        continue;
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength === 0) {
        errors.push(`${url} returned an empty image`);
        continue;
      }
      if (bytes.byteLength > IMAGE_ATTACHMENT_LIMIT_BYTES) {
        errors.push(`${url} is larger than the inline image limit`);
        continue;
      }

      const contentId = `homereach-inline-${index + 1}`;
      let name = imageNameForUrl(url, index);
      if (!name.includes(".")) name = `${name}.${contentTypeToExtension(contentType)}`;

      attachments.push({
        name,
        content: bytes.toString("base64"),
        contentType,
        contentId,
      });
      inlineImages.set(normalizeUrlForCompare(url), contentId);
    } catch (err) {
      errors.push(`${url} could not be fetched: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { attachments, inlineImages, errors };
}

function normalizeUrlForCompare(value: string) {
  return normalizeOutboundUrl(value).replace(/\/+$/, "");
}

function linkifyEscapedText(value: string): string {
  return escapeHtml(value).replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => {
      const href = normalizeOutboundUrl(url.replace(/&amp;/g, "&"));
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;font-weight:700;text-decoration:underline;word-break:break-word;">${escapeHtml(href)}</a>`;
    },
  );
}

function firstUrlInLine(line: string): string | null {
  return line.match(/https?:\/\/[^\s<]+/)?.[0] ?? null;
}

function renderMobileCta(url: string, label = "Review the mobile campaign plan") {
  const href = escapeHtml(normalizeOutboundUrl(url));
  return `
    <div style="margin:18px 0 22px 0;">
      <a href="${href}" target="_blank" rel="noopener noreferrer" style="box-sizing:border-box;display:block;width:100%;max-width:380px;border-radius:14px;background:#dc2626;color:#ffffff;text-align:center;text-decoration:none;font-weight:800;font-size:16px;line-height:1.25;padding:16px 18px;">
        ${escapeHtml(label)}
      </a>
      <div style="margin-top:9px;font-size:12px;line-height:1.5;color:#64748b;word-break:break-word;">
        If the button does not open, copy this link:<br>
        <a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;font-weight:700;text-decoration:underline;">${href}</a>
      </div>
    </div>
  `;
}

function renderDraftEmailHtml(
  body: string,
  options: {
    primaryCtaUrl?: string | null;
    primaryCtaLabel?: string;
    inlineImages?: Map<string, string>;
  } = {},
): string {
  const primaryCtaUrl = options.primaryCtaUrl
    ? normalizeOutboundUrl(options.primaryCtaUrl)
    : null;
  let primaryCtaRendered = false;

  const rendered = body
    .split(/\r?\n/)
    .map((line) => {
      const imageMatch = line.trim().match(/^\[\[image:(.+?)(?:\|(.+?))?\]\]$/);
      if (imageMatch) {
        const src = imageMatch[1]?.trim() ?? "";
        if (!isSafeHttpUrl(src)) return "";
        const alt = imageMatch[2]?.trim() || "HomeReach campaign plan visual";
        const normalizedSrc = normalizeOutboundUrl(src);
        const contentId = options.inlineImages?.get(normalizeUrlForCompare(normalizedSrc));
        const imageSrc = contentId ? `cid:${contentId}` : normalizedSrc;
        const image = `<img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(alt)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:14px;border:1px solid #dbe4f0;" />`;
        return `
          <div style="margin:22px 0;">
            ${
              primaryCtaUrl
                ? `<a href="${escapeHtml(primaryCtaUrl)}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;">${image}</a>`
                : image
            }
          </div>
        `;
      }
      if (!line.trim()) return '<div style="height:12px;line-height:12px;">&nbsp;</div>';

      const lineUrl = firstUrlInLine(line);
      const normalizedLineUrl = lineUrl ? normalizeOutboundUrl(lineUrl) : null;
      const isPrimaryCtaLine =
        primaryCtaUrl &&
        normalizedLineUrl &&
        normalizeUrlForCompare(normalizedLineUrl) ===
          normalizeUrlForCompare(primaryCtaUrl);
      const isPoliticalPlanLine =
        normalizedLineUrl &&
        /\/political(\?|#|$)/.test(new URL(normalizedLineUrl).pathname + new URL(normalizedLineUrl).search + new URL(normalizedLineUrl).hash);

      if ((isPrimaryCtaLine || isPoliticalPlanLine) && normalizedLineUrl) {
        const intro = line.replace(lineUrl ?? "", "").replace(/:\s*$/, "").trim();
        const introHtml = intro
          ? `<div style="margin:0 0 8px 0;">${escapeHtml(intro)}</div>`
          : "";
        primaryCtaRendered = primaryCtaRendered || Boolean(isPrimaryCtaLine);
        return `${introHtml}${renderMobileCta(
          primaryCtaUrl ?? normalizedLineUrl,
          options.primaryCtaLabel,
        )}`;
      }

      return `<div style="margin:0 0 8px 0;">${linkifyEscapedText(line)}</div>`;
    })
    .join("\n");

  const fallbackCta =
    primaryCtaUrl && !primaryCtaRendered
      ? renderMobileCta(primaryCtaUrl, options.primaryCtaLabel)
      : "";

  return `
    <div style="box-sizing:border-box;font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:18px 14px;color:#172033;line-height:1.58;font-size:15px;">
      ${rendered}
      ${fallbackCta}
    </div>
  `;
}

function normalizePoliticalEmailBody(body: string, primaryCtaUrl: string | null): string {
  if (!primaryCtaUrl) return body;

  return body
    .replace(
      /https?:\/\/(?:www\.)?home-reach\.com\/political\/candidate-agent\?candidate=([^\s]+)/g,
      (_match, candidate) => publicPoliticalPlanUrl(decodeURIComponent(candidate)),
    )
    .replace(
      /https?:\/\/(?:www\.)?home-reach\.com\/political\?candidate=([^\s&#]+)/g,
      (_match, candidate) => publicPoliticalPlanUrl(decodeURIComponent(candidate)),
    );
}

function bodyIncludesImageToken(body: string, imageUrl: string) {
  const normalizedImageUrl = normalizeOutboundUrl(imageUrl);
  return body.split(/\r?\n/).some((line) => {
    const imageMatch = line.trim().match(/^\[\[image:(.+?)(?:\|(.+?))?\]\]$/);
    return imageMatch ? normalizeOutboundUrl(imageMatch[1]?.trim() ?? "") === normalizedImageUrl : false;
  });
}

function imageTokenForVisual(visual: { url: string; alt: string }) {
  return `[[image:${visual.url}|${visual.alt}]]`;
}

function replaceApprovalImageToken(body: string, visual: { url: string; alt: string }) {
  const token = imageTokenForVisual(visual);
  if (/\[\[image:[^\]\r\n]+(?:\|[^\]\r\n]*)?\]\]/.test(body)) {
    return body.replace(/\[\[image:[^\]\r\n]+(?:\|[^\]\r\n]*)?\]\]/, token);
  }
  return `${body.trim()}\n\n${token}`.trim();
}

async function refreshDailyOutreachApprovalVisual(args: {
  supabase: ReturnType<typeof createServiceClient>;
  metadata: ApprovalMetadata;
  body: string;
}) {
  if (firstString(args.metadata.source_system) !== "daily_outreach_tasks") {
    return null;
  }
  const taskId = firstString(args.metadata.daily_outreach_task_id, args.metadata.source_id);
  if (!taskId) return null;

  const { data: task, error } = await args.supabase
    .from("daily_outreach_tasks")
    .select("id,outreach_date,sender_key,category,business_name,campaign_name,contact_name,industry,source_id,source_table,city,county,state,daily_sequence")
    .eq("id", taskId)
    .maybeSingle<DailyOutreachVisualTask>();
  if (error) throw error;
  if (!task?.sender_key) return null;

  const sequence = task.daily_sequence ?? 1;
  const displayName = task.business_name || task.campaign_name || "your organization";
  const seed = `${task.outreach_date}:${task.sender_key}:${displayName}:${sequence}`;
  const visual = visualForSenderDraft({
    senderKey: task.sender_key,
    date: task.outreach_date,
    sequence,
    category: task.category,
    businessName: task.business_name,
    campaignName: task.campaign_name,
    contactName: task.contact_name,
    industry: task.industry,
    sourceId: task.source_id,
    sourceTable: task.source_table,
    city: task.city,
    county: task.county,
    state: task.state,
  }, `${seed}:visual`);

  const body = replaceApprovalImageToken(args.body, visual);
  return {
    body,
    metadataPatch: {
      visual_url: visual.url,
      visual_alt: visual.alt,
      visual_type: visual.type,
      political_options_image_url:
        task.category === "Political Outreach" ? visual.url : args.metadata.political_options_image_url ?? null,
      refreshed_visual_at: new Date().toISOString(),
    },
  };
}

function renderTextBodyWithImageFallback(body: string, imageUrl: string | null, primaryCtaUrl: string | null) {
  let textBody = body.replace(/^\[\[image:(.+?)(?:\|.+?)?\]\]\s*$/gm, (_match, src) => {
    const safeSrc = isSafeHttpUrl(String(src ?? "")) ? normalizeOutboundUrl(String(src)) : imageUrl;
    return safeSrc ? `Four-option campaign mail screenshot:\n${safeSrc}` : "";
  });
  if (imageUrl && !textBody.includes(imageUrl)) {
    textBody = `${textBody.trim()}\n\nFour-option campaign mail screenshot:\n${imageUrl}`;
  }
  if (primaryCtaUrl && !textBody.includes(primaryCtaUrl)) {
    textBody = `${textBody.trim()}\n\nReview link:\n${primaryCtaUrl}`;
  }
  return textBody.trim();
}

function mergeMetadata(metadata: ApprovalMetadata, patch: ApprovalMetadata): ApprovalMetadata {
  return { ...metadata, ...patch };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ approvalId: string }> },
) {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const { approvalId } = await context.params;
  const supabase = createServiceClient();

  const { data: controls, error: controlsError } = await supabase
    .from("system_controls")
    .select("all_paused,email_paused,outreach_test_mode")
    .eq("id", 1)
    .maybeSingle();
  if (controlsError) return jsonError(controlsError.message, 503);

  if (controls?.all_paused) {
    return jsonError("Global outbound pause is enabled.", 409);
  }
  if (controls?.email_paused) {
    return jsonError("Email channel pause is enabled.", 409);
  }

  const { data: approval, error: approvalError } = await supabase
    .from("revenue_message_approval_queue")
    .select("id,thread_id,business_line,channel,status,title,message_body,metadata")
    .eq("id", approvalId)
    .maybeSingle<ApprovalRow>();

  if (approvalError) return jsonError(approvalError.message, 500);
  if (!approval) return jsonError("Approval item not found.", 404);
  if (approval.channel !== "email") return jsonError("Only email approvals can be sent from this action.", 400);
  if (approval.status !== "approved") {
    return jsonError("Human approval is required before this email can be sent.", 409, {
      approval_status: approval.status,
    });
  }

  let metadata = metadataObject(approval.metadata);
  const toEmail = normalizeEmail(firstString(metadata.to_email, metadata.contact_email, metadata.email));
  const requestedSenderEmail = normalizeEmail(firstString(metadata.sender_email, metadata.from_email));
  const subject = firstString(metadata.subject, approval.title);
  const candidateSlug = firstString(metadata.candidate_slug);
  const rawPlanUrl = firstString(metadata.political_plan_url, metadata.plan_url);
  const primaryCtaUrl = rawPlanUrl
    ? normalizeOutboundUrl(rawPlanUrl)
    : approval.business_line === "political"
      ? publicPoliticalPlanUrl(candidateSlug)
      : null;
  let body = normalizePoliticalEmailBody(
    approval.message_body?.trim() ?? "",
    primaryCtaUrl,
  );
  const senderEmail = approval.business_line === "political"
    ? POLITICAL_REQUIRED_SENDER_EMAIL
    : requestedSenderEmail;

  if (!toEmail) return jsonError("Missing or invalid recipient email.", 400);
  if (approval.business_line === "political" && requestedSenderEmail !== POLITICAL_REQUIRED_SENDER_EMAIL) {
    await moveApprovalBackToReview({
      supabase,
      approval,
      metadata,
      reason: "Political email sender must be Jason McCurry at jason@home-reach.com.",
      patch: {
        expected_sender_email: POLITICAL_REQUIRED_SENDER_EMAIL,
        requested_sender_email: requestedSenderEmail,
      },
    });
    return jsonError("Political email sender must be Jason McCurry at jason@home-reach.com.", 400);
  }
  if (!senderEmail || !allowedSenderEmails().has(senderEmail)) {
    return jsonError("Sender must be one of the verified HomeReach sender identities.", 400);
  }
  if (!subject) return jsonError("Missing email subject.", 400);
  if (!body) return jsonError("Missing email body.", 400);

  const dailyOutreachTaskId = firstString(metadata.daily_outreach_task_id);
  if (firstString(metadata.source_system) === "daily_outreach_tasks") {
    if (!dailyOutreachTaskId) {
      return jsonError("Daily outreach approval is missing a linked task id.", 409);
    }
    const taskBlockReason = await dailyOutreachTaskBlockReason({
      supabase,
      taskId: dailyOutreachTaskId,
      toEmail,
    });
    if (taskBlockReason) {
      await moveApprovalBackToReview({
        supabase,
        approval,
        metadata,
        reason: taskBlockReason,
      });
      return jsonError(taskBlockReason, 409);
    }
  }

  const visualRefresh = await refreshDailyOutreachApprovalVisual({
    supabase,
    metadata,
    body,
  });
  if (visualRefresh) {
    body = visualRefresh.body;
    metadata = mergeMetadata(metadata, visualRefresh.metadataPatch);
    await supabase
      .from("revenue_message_approval_queue")
      .update({
        message_body: body,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", approval.id)
      .in("status", ["draft", "needs_review", "approved"]);
  }

  const emailSuppressionReason = await emailSuppressionBlockReason({
    supabase,
    metadata,
    toEmail,
  });
  if (emailSuppressionReason) {
    await moveApprovalBackToReview({
      supabase,
      approval,
      metadata,
      reason: emailSuppressionReason,
    });
    return jsonError(emailSuppressionReason, 409);
  }

  const isCandidateAgentPoliticalSend =
    approval.business_line === "political" &&
    firstString(metadata.workflow) === "candidate_agent_sales_follow_up";
  if (
    isCandidateAgentPoliticalSend &&
    !isPlanStatusSendSafe(metadata.plan_status) &&
    !hasOwnerOverride(metadata)
  ) {
    await moveApprovalBackToReview({
      supabase,
      approval,
      metadata,
      reason: "Political plan is not approved for outreach send.",
      patch: { plan_status: metadata.plan_status ?? null },
    });
    return jsonError("Political plan must be approved before this email can be sent.", 409, {
      plan_status: metadata.plan_status ?? null,
    });
  }

  if (approval.business_line === "political") {
    const expectedPoliticalImageUrl = firstString(metadata.political_options_image_url);
    if (!expectedPoliticalImageUrl || !bodyIncludesImageToken(body, expectedPoliticalImageUrl)) {
      await moveApprovalBackToReview({
        supabase,
        approval,
        metadata,
        reason: "Political email must include the approved four-option campaign screenshot token before sending.",
        patch: {
          expected_political_options_image_url: expectedPoliticalImageUrl,
          requires_political_options_image: true,
        },
      });
      return jsonError("Political email must include the approved four-option campaign screenshot before sending.", 400);
    }

    const suppressionReason = await politicalSuppressionBlockReason({
      supabase,
      metadata,
      toEmail,
    });
    if (suppressionReason) {
      await moveApprovalBackToReview({
        supabase,
        approval,
        metadata,
        reason: suppressionReason,
      });
      return jsonError(suppressionReason, 409);
    }
  }

  const inlineImageResult = await buildInlineImageAttachments(body);
  if (approval.business_line === "political" && inlineImageResult.errors.length > 0) {
    await moveApprovalBackToReview({
      supabase,
      approval,
      metadata,
      reason: "Political email image could not be embedded before sending.",
      patch: {
        inline_image_errors: inlineImageResult.errors,
        requires_inline_image_attachment: true,
      },
    });
    return jsonError("Political email image could not be embedded before sending.", 400, {
      image_errors: inlineImageResult.errors,
    });
  }

  const deliverability = auditDeliverabilityCopy(`${subject}\n\n${body}`, "email");
  if (deliverability.status === "blocked") {
    await moveApprovalBackToReview({
      supabase,
      approval,
      metadata,
      reason: "Deliverability review blocked this send.",
      actorId: guard.user?.id ?? null,
      actorLabel: guard.user?.email ?? "admin",
      patch: {
        deliverability_status: deliverability.status,
        deliverability_flags: deliverability.flags,
        deliverability_notes: deliverability.notes,
      },
    });
    return jsonError("Deliverability review blocked this send.", 400, { deliverability });
  }

  const { data: identity, error: identityError } = await supabase
    .from("agent_identities")
    .select("agent_id,from_email,from_name,reply_to_email,is_active")
    .ilike("from_email", senderEmail)
    .maybeSingle<AgentIdentity>();

  if (identityError) return jsonError(identityError.message, 500);
  if (!identity?.agent_id || identity.is_active === false) {
    return jsonError("Sender identity is missing or inactive in agent_identities.", 400);
  }

  const reputation = await evaluateOutboundReputation({
    supabase,
    senderEmail,
    senderName: firstString(metadata.sender_name, identity.from_name) ?? "HomeReach",
    channel: "email",
    recipient: toEmail,
    businessLine: approval.business_line,
    sourceSystem: firstString(metadata.source_system) ?? "revenue_message_approval_queue",
    sourceId: outboundSourceId(metadata, approval.id),
    subject,
    body,
    templateKey: firstString(metadata.template_id, metadata.template_key, approval.title),
    humanApproved: true,
    autonomous: false,
    recipientSource: approval.business_line === "political" ? "public_campaign_contact" : "unknown",
    deliverabilityStatus: deliverability.status,
    deliverabilityFlags: deliverability.flags,
    metadata: {
      approval_id: approval.id,
      approval_status: approval.status,
      deliverability,
      political_plan_url: primaryCtaUrl,
    },
  });
  await logReputationDecision(supabase, {
    senderEmail,
    senderName: firstString(metadata.sender_name, identity.from_name) ?? "HomeReach",
    channel: "email",
    recipient: toEmail,
    businessLine: approval.business_line,
    sourceSystem: firstString(metadata.source_system) ?? "revenue_message_approval_queue",
    sourceId: outboundSourceId(metadata, approval.id),
    subject,
    body,
    templateKey: firstString(metadata.template_id, metadata.template_key, approval.title),
    humanApproved: true,
    autonomous: false,
    recipientSource: approval.business_line === "political" ? "public_campaign_contact" : "unknown",
    deliverabilityStatus: deliverability.status,
    deliverabilityFlags: deliverability.flags,
    metadata: { approval_id: approval.id },
  }, reputation);

  if (!reputation.allowed) {
    await moveApprovalBackToReview({
      supabase,
      approval,
      metadata,
      reason: "Reputation control blocked this send.",
      actorId: guard.user?.id ?? null,
      actorLabel: guard.user?.email ?? "admin",
      patch: {
        reputation_status: reputation.level,
        reputation_score: reputation.score,
        reputation_decision: reputation.decision,
        reputation_blockers: reputation.blockers,
        reputation_warnings: reputation.warnings,
        reputation_recommended_action: reputation.recommendedAction,
      },
    });
    return jsonError("Reputation control blocked this send.", 409, { reputation });
  }

  const { data: limitCheck, error: limitError } = await supabase.rpc("check_and_increment_send_count", {
    p_agent_id: identity.agent_id,
    p_channel: "email",
  });
  if (limitError) return jsonError(limitError.message, 500);

  const sendLimit = limitCheck as { allowed?: boolean; reason?: string; remaining?: number; sent?: number } | null;
  if (sendLimit && sendLimit.allowed === false) {
    return jsonError(sendLimit.reason ?? "Daily sender limit reached.", 429, { sendLimit });
  }

  const requestedReplyTo = normalizeEmail(firstString(metadata.reply_to, identity.reply_to_email, senderEmail));
  if (approval.business_line === "political" && requestedReplyTo !== POLITICAL_REQUIRED_SENDER_EMAIL) {
    await moveApprovalBackToReview({
      supabase,
      approval,
      metadata,
      reason: "Political email reply-to must be jason@home-reach.com.",
      patch: {
        expected_reply_to: POLITICAL_REQUIRED_SENDER_EMAIL,
        requested_reply_to: requestedReplyTo,
      },
    });
    return jsonError("Political email reply-to must be jason@home-reach.com.", 400);
  }

  const fromName = approval.business_line === "political"
    ? POLITICAL_REQUIRED_SENDER_NAME
    : firstString(metadata.sender_name, identity.from_name) ?? "HomeReach";
  const replyTo = approval.business_line === "political"
    ? POLITICAL_REQUIRED_SENDER_EMAIL
    : requestedReplyTo ?? senderEmail;
  const text = appendEmailComplianceText(
    renderTextBodyWithImageFallback(body, firstString(metadata.political_options_image_url), primaryCtaUrl),
    toEmail,
  );
  const html = appendEmailComplianceHtml(
    renderDraftEmailHtml(body, {
      primaryCtaUrl,
      primaryCtaLabel: "Review the mobile campaign plan",
      inlineImages: inlineImageResult.inlineImages,
    }),
    toEmail,
  );
  const claimedAt = new Date().toISOString();
  const claimedMetadata = mergeMetadata(metadata, {
    send_claimed_at: claimedAt,
    send_claimed_by: guard.user?.id ?? null,
    send_claim_state: "scheduled",
  });
  const { data: claimedApproval, error: claimError } = await supabase
    .from("revenue_message_approval_queue")
    .update({
      status: "scheduled",
      updated_at: claimedAt,
      metadata: claimedMetadata,
    })
    .eq("id", approval.id)
    .eq("status", "approved")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (claimError) return jsonError(claimError.message, 500);
  if (!claimedApproval) {
    return jsonError("This approval is already being sent or is no longer approved.", 409);
  }
  metadata = claimedMetadata;

  const claimedLedgerResult = await syncRevenueApprovalLedger(
    {
      id: approval.id,
      businessLine: approval.business_line,
      channel: approval.channel,
      status: "scheduled",
      title: approval.title,
      messageBody: approval.message_body,
      metadata,
      threadId: approval.thread_id,
      updatedAt: claimedAt,
    },
    {
      actorId: guard.user?.id ?? null,
      actorLabel: guard.user?.email ?? "admin",
      eventType: "revenue_approval_scheduled",
    },
  );
  if (!claimedLedgerResult.ok && claimedLedgerResult.error) {
    console.warn("[approval-ledger] revenue approval scheduled sync skipped:", claimedLedgerResult.error);
  }

  const result = await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    replyTo,
    fromEmail: senderEmail,
    fromName,
    provider: "postmark",
    messageStream: firstString(metadata.message_stream, process.env.POSTMARK_BROADCAST_MESSAGE_STREAM, process.env.POSTMARK_MESSAGE_STREAM) ?? "outbound",
    tags: outboundTags(approval, metadata),
    metadata: {
      approval_id: approval.id,
      business_line: approval.business_line,
      source_system: firstString(metadata.source_system) ?? "revenue_message_approval_queue",
      source_id: outboundSourceId(metadata, approval.id),
      candidate_slug: firstString(metadata.candidate_slug) ?? "",
      reputation_score: String(reputation.score),
      reputation_level: reputation.level,
      reputation_decision: reputation.decision,
    },
    intent: "prospecting",
    testMode: Boolean(controls?.outreach_test_mode),
    attachments: inlineImageResult.attachments,
  });

  if (!result.success) {
    const failedAt = new Date().toISOString();
    const failedMetadata = mergeMetadata(metadata, {
      last_send_failed_at: failedAt,
      last_send_error: result.error ?? "Email send failed.",
      provider: result.provider ?? "postmark",
      sender_email: senderEmail,
      to_email: toEmail,
    });
    await supabase
      .from("revenue_message_approval_queue")
      .update({
        status: "needs_review",
        updated_at: failedAt,
        metadata: failedMetadata,
      })
      .eq("id", approval.id);

    const failedLedgerResult = await syncRevenueApprovalLedger(
      {
        id: approval.id,
        businessLine: approval.business_line,
        channel: approval.channel,
        status: "needs_review",
        title: approval.title,
        messageBody: approval.message_body,
        metadata: failedMetadata,
        threadId: approval.thread_id,
        updatedAt: failedAt,
      },
      {
        actorId: guard.user?.id ?? null,
        actorLabel: guard.user?.email ?? "admin",
        eventType: "revenue_approval_send_failed",
        eventNotes: result.error ?? "Email send failed.",
      },
    );
    if (!failedLedgerResult.ok && failedLedgerResult.error) {
      console.warn("[approval-ledger] revenue approval failed-send sync skipped:", failedLedgerResult.error);
    }

    if (dailyOutreachTaskId) {
      await supabase
        .from("daily_outreach_tasks")
        .update({
          send_status: "failed",
          delivery_status: "failed",
          last_error: result.error ?? "Email send failed.",
          send_attempts: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dailyOutreachTaskId);
    }

    await logPlatformAuditEvent({
      actorType: "human",
      actorId: guard.user?.id ?? null,
      actorLabel: guard.user?.email ?? "admin",
      module: "revenue_messaging",
      actionType: "approval_email_send_failed",
      entityType: "revenue_message_approval_queue",
      entityId: approval.id,
      channel: "email",
      provider: result.provider ?? "postmark",
      resultStatus: "failure",
      approvalState: "needs_review",
      severity: "medium",
      errorMessage: result.error ?? null,
      metadata: { to_email: toEmail, sender_email: senderEmail },
    });

    return jsonError(result.error ?? "Email send failed.", 502);
  }

  const sentAt = new Date().toISOString();
  const sentMetadata = mergeMetadata(metadata, {
    human_approved: true,
    human_approved_by: guard.user?.id ?? null,
    sent_at: sentAt,
    provider: result.provider ?? "postmark",
    provider_message_id: result.externalId ?? null,
    sender_email: senderEmail,
    sender_name: fromName,
    to_email: toEmail,
    political_plan_url: primaryCtaUrl ?? firstString(metadata.political_plan_url),
    deliverability_status: deliverability.status,
    deliverability_flags: deliverability.flags,
    deliverability_notes: deliverability.notes,
    reputation_status: reputation.level,
    reputation_score: reputation.score,
    reputation_decision: reputation.decision,
    reputation_recommended_action: reputation.recommendedAction,
    send_limit: sendLimit,
  });
  await supabase
    .from("revenue_message_approval_queue")
    .update({
      status: "sent",
      updated_at: sentAt,
      metadata: sentMetadata,
    })
    .eq("id", approval.id);
  metadata = sentMetadata;

  const sentLedgerResult = await syncRevenueApprovalLedger(
    {
      id: approval.id,
      businessLine: approval.business_line,
      channel: approval.channel,
      status: "sent",
      title: approval.title,
      messageBody: approval.message_body,
      metadata,
      threadId: approval.thread_id,
      updatedAt: sentAt,
    },
    {
      actorId: guard.user?.id ?? null,
      actorLabel: guard.user?.email ?? "admin",
      eventType: "revenue_approval_sent",
    },
  );
  if (!sentLedgerResult.ok && sentLedgerResult.error) {
    console.warn("[approval-ledger] revenue approval sent sync skipped:", sentLedgerResult.error);
  }

  if (dailyOutreachTaskId) {
    await supabase
      .from("daily_outreach_tasks")
      .update({
        send_status: "sent",
        delivery_status: result.testMode ? "test_logged" : "sent",
        provider_message_id: result.externalId ?? null,
        approval_status: "sent",
        send_attempts: 1,
        completed: true,
        completed_at: sentAt,
        completed_by: guard.user?.id ?? null,
        status: "completed",
        last_action_at: sentAt,
        updated_at: sentAt,
      })
      .eq("id", dailyOutreachTaskId);
  }
  await markDailyOutreachSourceContacted({ supabase, metadata, sentAt });

  await recordOutboundRevenueMessage({
    businessLine: approval.business_line,
    sourceSystem: outboundSourceSystem(metadata),
    sourceId: outboundSourceId(metadata, approval.id),
    channel: "email",
    body,
    to: toEmail,
    from: senderEmail,
    subject,
    provider: result.provider ?? "postmark",
    providerMessageId: result.externalId ?? null,
    contactName: firstString(metadata.contact_name, metadata.candidate_name),
    contactEmail: toEmail,
    displayName: firstString(metadata.display_name, metadata.candidate_name, metadata.organization_name),
    organizationName: firstString(metadata.organization_name, metadata.campaign_name),
    city: firstString(metadata.city),
    category: outboundCategory(approval, metadata),
    assignedTo: identity.agent_id,
    metadata: {
      approval_id: approval.id,
      human_approved_by: guard.user?.id ?? null,
      candidate_slug: firstString(metadata.candidate_slug),
      political_options_image_url: firstString(metadata.political_options_image_url),
      political_plan_url: primaryCtaUrl ?? firstString(metadata.political_plan_url),
      reputation,
    },
  });

  await logPlatformAuditEvent({
    actorType: "human",
    actorId: guard.user?.id ?? null,
    actorLabel: guard.user?.email ?? "admin",
    module: "revenue_messaging",
    actionType: "approval_email_sent",
    entityType: "revenue_message_approval_queue",
    entityId: approval.id,
    sourceTable: firstString(metadata.source_system) ?? "revenue_message_approval_queue",
    sourceId: outboundSourceId(metadata, approval.id),
    channel: "email",
    provider: result.provider ?? "postmark",
    resultStatus: "success",
    approvalState: "sent",
    severity: "info",
    message: `Admin approved and sent one ${outboundCategory(approval, metadata).toLowerCase()} email from ${senderEmail}.`,
    metadata: {
      to_email: toEmail,
      sender_email: senderEmail,
      provider_message_id: result.externalId ?? null,
      test_mode: Boolean(result.testMode),
      reputation_score: reputation.score,
      reputation_level: reputation.level,
      reputation_decision: reputation.decision,
    },
  });

  return NextResponse.json({
    ok: true,
    message: result.testMode ? "Test-mode email logged." : "Email sent and logged.",
    provider: result.provider ?? "postmark",
    providerMessageId: result.externalId ?? null,
    testMode: Boolean(result.testMode),
    reputation,
  });
}
