import { sendEmail } from "@homereach/services/outreach";
import {
  DIGITAL_TARGETING_MANAGEMENT_FEE_CENTS,
  DIGITAL_TARGETING_PRODUCT_NAME,
  formatUsd,
} from "./config";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com").replace(/\/+$/, "");
}

function adminEmail() {
  return (
    process.env.ADMIN_NOTIFICATION_EMAIL ??
    process.env.ADMIN_EMAIL ??
    process.env.DEFAULT_FROM_EMAIL ??
    "admin@home-reach.com"
  );
}

function escapeHtml(value: string | null | undefined) {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(value: string | null | undefined) {
  return value?.trim().split(/\s+/)[0] || "there";
}

async function safeSend(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: string[];
  metadata?: Record<string, string>;
}) {
  try {
    const result = await sendEmail({
      ...options,
      intent: "transactional",
      tags: options.tags ?? ["digital-targeting"],
    });
    if (!result.success) console.error("[digital-targeting/email] failed:", result.error);
    return result;
  } catch (err) {
    console.error("[digital-targeting/email] exception:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendDigitalIntakeConfirmation(input: {
  campaignId: string;
  businessName: string;
  contactName?: string | null;
  email: string;
  checkoutUrl: string;
}) {
  const name = firstName(input.contactName);
  const management = formatUsd(DIGITAL_TARGETING_MANAGEMENT_FEE_CENTS);
  return safeSend({
    to: input.email,
    subject: "We received your Neighborhood Digital Targeting request",
    html: `
      <p>Hi ${escapeHtml(name)},</p>
      <p>We received the ${escapeHtml(DIGITAL_TARGETING_PRODUCT_NAME)} request for <strong>${escapeHtml(input.businessName)}</strong>.</p>
      <p>HomeReach will review your target areas, ad spend plan, creative assets, and launch requirements before anything goes live.</p>
      <p>The management fee is <strong>${escapeHtml(management)}/month</strong>. Ad spend is controlled and funded separately by you.</p>
      <p style="margin:22px 0"><a href="${escapeHtml(input.checkoutUrl)}" style="background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Review payment step</a></p>
      <p>Results vary, and all ads remain subject to platform approval and policy availability.</p>
    `,
    text: `Hi ${name}, we received the ${DIGITAL_TARGETING_PRODUCT_NAME} request for ${input.businessName}. Review the payment step here: ${input.checkoutUrl}. The management fee is ${management}/month; ad spend is separate.`,
    metadata: { campaignId: input.campaignId },
  });
}

export async function notifyAdminDigitalIntake(input: {
  campaignId: string;
  businessName: string;
  contactName?: string | null;
  email: string;
  phone?: string | null;
  objective: string;
  targetingType: string;
}) {
  const url = `${appUrl()}/admin/digital-targeting/${input.campaignId}`;
  return safeSend({
    to: adminEmail(),
    subject: `Digital Targeting intake: ${input.businessName}`,
    html: `
      <h2>New Digital Targeting Intake</h2>
      <p><strong>${escapeHtml(input.businessName)}</strong> submitted a Neighborhood Digital Targeting request.</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Contact</td><td>${escapeHtml(input.contactName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Email</td><td>${escapeHtml(input.email)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Phone</td><td>${escapeHtml(input.phone)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Objective</td><td>${escapeHtml(input.objective)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Targeting</td><td>${escapeHtml(input.targetingType)}</td></tr>
      </table>
      <p style="margin-top:16px"><a href="${escapeHtml(url)}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700">Open campaign</a></p>
    `,
    text: `New Digital Targeting intake: ${input.businessName}. Open ${url}`,
    metadata: { campaignId: input.campaignId },
  });
}

export async function sendDigitalPaymentConfirmation(input: {
  businessName: string;
  contactName?: string | null;
  email: string;
}) {
  const name = firstName(input.contactName);
  return safeSend({
    to: input.email,
    subject: "Payment confirmed for your Neighborhood Digital Targeting campaign",
    html: `
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your HomeReach management fee is confirmed for <strong>${escapeHtml(input.businessName)}</strong>.</p>
      <p>Next, HomeReach will review your target areas, confirm ad spend, prepare creative, and send launch-ready details before any ads go live.</p>
      <p>No paid ad launch happens without approval.</p>
    `,
    text: `Hi ${name}, payment is confirmed for ${input.businessName}. HomeReach will review target areas, confirm ad spend, prepare creative, and send launch-ready details before any ads go live.`,
  });
}

export async function sendDigitalLaunchConfirmation(input: {
  businessName: string;
  contactName?: string | null;
  email: string;
}) {
  const name = firstName(input.contactName);
  return safeSend({
    to: input.email,
    subject: "Your Neighborhood Digital Targeting campaign is live",
    html: `
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your campaign for <strong>${escapeHtml(input.businessName)}</strong> has been marked live by the HomeReach team.</p>
      <p>We will monitor available metrics and keep your monthly report focused on impressions, clicks, spend, leads/calls where available, and recommended next steps.</p>
    `,
    text: `Hi ${name}, your campaign for ${input.businessName} has been marked live. We will monitor available metrics and monthly recommendations.`,
  });
}
