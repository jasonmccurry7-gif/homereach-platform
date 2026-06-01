// ─────────────────────────────────────────────────────────────────────────────
// Targeted Route Campaign — Messaging Service
//
// Sends human-sounding, simple messages at each pipeline stage.
// All messaging is logged to console so nothing is lost if env vars are missing.
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildOwnerSignature,
  getDefaultEmailIdentity,
  getOwnerIdentity,
  sendEmail,
  sendSms,
} from "../outreach/index";

// ── Config ────────────────────────────────────────────────────────────────────

function getAdminEmail(): string {
  // Canonical variable: ADMIN_NOTIFICATION_EMAIL
  // Legacy fallback: ADMIN_EMAIL (accepted during transition, will be removed post-launch)
  // Final fallback: MAILGUN_FROM_EMAIL (sender address, not ideal but beats a dead drop)
  // Hard fallback: literal address (logs a warning so ops notices in dev)
  const email =
    process.env.ADMIN_NOTIFICATION_EMAIL ??
    process.env.ADMIN_EMAIL ??
    process.env.MAILGUN_FROM_EMAIL ??
    getOwnerIdentity().domainEmail;

  if (!email) {
    console.warn(
      "[targeted/messaging] ADMIN_NOTIFICATION_EMAIL is not set — " +
      "admin notifications will be sent to the placeholder address. " +
      "Set ADMIN_NOTIFICATION_EMAIL in your environment."
    );
    return "admin@homereach.com";
  }

  return email;
}

function getAdminPhone(): string | null {
  return process.env.ADMIN_PHONE ?? getOwnerIdentity().cellPhone;
}

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "https://www.home-reach.com"
  ).replace(/\/+$/, "");
}

function getFromName(): string {
  return getDefaultEmailIdentity().fromName;
}

function textValue(value: string | null | undefined, fallback = ""): string {
  return (value ?? "").replace(/[\r\n\t]+/g, " ").trim() || fallback;
}

function subjectValue(value: string): string {
  return textValue(value).slice(0, 180);
}

function escapeHtml(value: string | null | undefined, fallback = ""): string {
  return textValue(value, fallback)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstNameFrom(value: string | null | undefined): string {
  return textValue(value).split(/\s+/)[0] || "there";
}

function safeUrl(value: string): string {
  return textValue(value).replace(/"/g, "%22").replace(/'/g, "%27");
}

// ── Helper: safe send (never throws, always logs) ─────────────────────────────

async function safeEmail(to: string, subject: string, html: string, text: string) {
  const safeSubject = subjectValue(subject);
  console.log(`[targeted/messaging] email → ${to} | ${safeSubject}`);
  try {
    const emailIdentity = getDefaultEmailIdentity();
    const result = await sendEmail({
      to,
      subject: safeSubject,
      html,
      text,
      fromEmail: emailIdentity.fromEmail,
      fromName: emailIdentity.fromName,
      replyTo: emailIdentity.replyTo,
    });
    if (!result.success) {
      console.error(`[targeted/messaging] email failed: ${result.error}`);
    }
    return result;
  } catch (err) {
    console.error(`[targeted/messaging] email exception:`, err);
    return { success: false, error: String(err) };
  }
}

async function safeSms(to: string, body: string) {
  if (!to || to.length < 10) return { success: false, error: "no phone" };
  const safeBody = textValue(body);
  console.log(`[targeted/messaging] sms → ${to}`);
  try {
    const result = await sendSms({ to, body: safeBody, intent: "internal" });
    if (!result.success) {
      console.warn(`[targeted/messaging] optional sms skipped: ${result.error}`);
    }
    return result;
  } catch (err) {
    console.warn(`[targeted/messaging] optional sms exception:`, err);
    return { success: false, error: String(err) };
  }
}

// ── Message 1: Lead received (notify admin) ───────────────────────────────────

export async function notifyAdminNewLead(lead: {
  name?: string | null;
  businessName?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  source: string;
}) {
  const adminEmail = getAdminEmail();
  const adminPhone = getAdminPhone();
  const name = textValue(lead.name) || textValue(lead.businessName) || "Unknown";
  const baseUrl = safeUrl(getBaseUrl());
  const adminCampaignsUrl = `${baseUrl}/admin/targeted-campaigns`;

  const subject = subjectValue(`New Lead: ${name}`);
  const html = `
    <h2 style="color:#1d4ed8">New Targeted Campaign Lead</h2>
    <table style="border-collapse:collapse;font-size:14px">
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Name</td><td><strong>${escapeHtml(lead.name, "—")}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Business</td><td>${escapeHtml(lead.businessName, "—")}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Email</td><td>${escapeHtml(lead.email, "—")}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Phone</td><td>${escapeHtml(lead.phone, "—")}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">City</td><td>${escapeHtml(lead.city, "—")}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Source</td><td>${escapeHtml(lead.source)}</td></tr>
    </table>
    <p style="margin-top:16px">
      <a href="${escapeHtml(adminCampaignsUrl)}" style="background:#1d4ed8;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">View in Admin</a>
    </p>
  `;
  const text = `New lead: ${name} | ${textValue(lead.email, "no email")} | ${textValue(lead.phone, "no phone")} | ${textValue(lead.city, "no city")} | Source: ${textValue(lead.source)}`;

  await safeEmail(adminEmail, subject, html, text);

  if (adminPhone) {
    await safeSms(adminPhone, `New HomeReach lead: ${name} (${textValue(lead.source)}) - ${textValue(lead.phone) || textValue(lead.email) || "no contact"}`);
  }
}

// ── Message 2: Intake link sent to lead ──────────────────────────────────────

export async function sendIntakeLinkToLead(lead: {
  name?: string | null;
  email: string;
  phone?: string | null;
  intakeToken: string;
}) {
  const baseUrl = getBaseUrl();
  const intakeUrl = safeUrl(`${baseUrl}/targeted/intake?token=${lead.intakeToken}`);
  const firstName = firstNameFrom(lead.name);
  const signature = buildOwnerSignature();
  const signatureHtml = escapeHtml(signature).replace(/\n/g, "<br>");

  const subject = `Your HomeReach Campaign Setup — 5-minute form`;
  const html = `
    <p style="font-size:16px">Hey ${escapeHtml(firstName)},</p>
    <p>Thanks for your interest in HomeReach. We help local businesses stay visible with nearby homeowners without making you manage another complicated marketing system.</p>
    <p>To start the campaign plan, fill out this quick form. It takes about 5 minutes and gives us what we need to handle the next steps clearly.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${escapeHtml(intakeUrl)}" style="background:#1d4ed8;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:bold">Set Up My Campaign →</a>
    </p>
    <p style="color:#6b7280;font-size:13px">Link: <a href="${escapeHtml(intakeUrl)}">${escapeHtml(intakeUrl)}</a></p>
    <p>Once we have your info, we handle the campaign path: design, print setup, mailing, and the visibility plan for the homes around you.</p>
    <p>Any questions? Just reply to this email.</p>
    <p>${signatureHtml}</p>
  `;
  const text = `Hey ${firstName}, here is your HomeReach intake link: ${intakeUrl}\n\nIt takes about 5 minutes. Once it is in, we will handle the next campaign step clearly.\n\n${signature}`;

  return safeEmail(lead.email, subject, html, text);
}

// ── Message 2b: Intake reminder (if not submitted after 24h) ─────────────────

export async function sendIntakeReminder(lead: {
  name?: string | null;
  email: string;
  phone?: string | null;
  intakeToken: string;
}) {
  const baseUrl = getBaseUrl();
  const intakeUrl = safeUrl(`${baseUrl}/targeted/intake?token=${lead.intakeToken}`);
  const firstName = firstNameFrom(lead.name);

  const subject = `Quick reminder — your HomeReach campaign setup`;
  const html = `
    <p>Hey ${escapeHtml(firstName)}, quick reminder that your HomeReach campaign setup form is ready.</p>
    <p>It only takes a few minutes and keeps the next step simple on your side:</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${escapeHtml(intakeUrl)}" style="background:#1d4ed8;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:bold">Complete My Setup →</a>
    </p>
    <p style="color:#6b7280;font-size:13px">Or copy this link: ${escapeHtml(intakeUrl)}</p>
    <p>Reply if you have any questions. We are here to make the process feel clear, not stressful.</p>
  `;
  const text = `Hey ${firstName}, quick reminder to complete your HomeReach campaign setup: ${intakeUrl}`;

  await safeEmail(lead.email, subject, html, text);

  if (lead.phone) {
    await safeSms(
      lead.phone,
      `Hi ${firstName}, quick reminder to complete your HomeReach campaign setup: ${intakeUrl}`
    );
  }
}

// ── Message 3: Intake submitted — admin notification ─────────────────────────

export async function notifyAdminIntakeReceived(campaign: {
  businessName: string;
  contactName?: string | null;
  email: string;
  phone?: string | null;
  targetCity?: string | null;
  targetAreaNotes?: string | null;
  businessAddress?: string | null;
  campaignId: string;
}) {
  const adminEmail = getAdminEmail();
  const baseUrl = safeUrl(getBaseUrl());
  const adminCampaignsUrl = `${baseUrl}/admin/targeted-campaigns`;
  const businessName = textValue(campaign.businessName, "Unknown business");

  const subject = subjectValue(`Intake Complete: ${businessName}`);
  const html = `
    <h2 style="color:#1d4ed8">Intake Form Received</h2>
    <p><strong>${escapeHtml(businessName)}</strong> has completed their intake form and is ready to pay.</p>
    <table style="border-collapse:collapse;font-size:14px;margin-top:12px">
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Contact</td><td>${escapeHtml(campaign.contactName, "—")}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Email</td><td>${escapeHtml(campaign.email)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Phone</td><td>${escapeHtml(campaign.phone, "—")}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Address</td><td>${escapeHtml(campaign.businessAddress, "—")}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Target City</td><td>${escapeHtml(campaign.targetCity, "—")}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Target Area</td><td>${escapeHtml(campaign.targetAreaNotes, "—")}</td></tr>
    </table>
    <p style="margin-top:16px">
      <a href="${escapeHtml(adminCampaignsUrl)}" style="background:#059669;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">View Campaign</a>
    </p>
  `;

  return safeEmail(adminEmail, subject, html, `Intake complete: ${businessName} | ${textValue(campaign.email)} | ${textValue(campaign.targetCity, "no city")}`);
}

// ── Message 3b: Intake submitted — confirmation to customer ──────────────────

export async function sendIntakeConfirmationToCustomer(campaign: {
  contactName?: string | null;
  email: string;
  businessName: string;
  campaignId: string;
  checkoutUrl?: string;
  homesCount?: number;
  priceCents?: number;
}) {
  const firstName = firstNameFrom(campaign.contactName);
  const baseUrl = getBaseUrl();
  const checkoutUrl = safeUrl(campaign.checkoutUrl ?? `${baseUrl}/targeted/checkout`);
  const businessName = textValue(campaign.businessName, "your business");
  const amount =
    typeof campaign.priceCents === "number" && campaign.priceCents > 0
      ? (campaign.priceCents / 100).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })
      : "your approved campaign total";
  const homes =
    typeof campaign.homesCount === "number" && campaign.homesCount > 0
      ? campaign.homesCount.toLocaleString()
      : "your selected";

  const subject = "We got your info - your secure checkout link is ready";
  const html = `
    <p>Hey ${escapeHtml(firstName)},</p>
    <p>We've received the campaign details for <strong>${escapeHtml(businessName)}</strong>. You are one step away from turning the plan into real local mailbox visibility.</p>
    <p>Click below to complete the reviewed campaign payment and move the campaign into production planning:</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${escapeHtml(checkoutUrl)}" style="background:#1d4ed8;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:bold">Complete Payment - ${escapeHtml(amount)}</a>
    </p>
    <p>What happens next:</p>
    <ul style="color:#374151;font-size:14px">
      <li>Our design team creates your postcard</li>
      <li>You approve the design before production</li>
      <li>We print, stamp, and mail to ${homes} homes around you</li>
    </ul>
    <p>Questions? Just reply to this email.</p>
  `;
  const text = `Hey ${firstName}, we received your campaign details. Complete payment here to move into production planning: ${checkoutUrl}`;

  return safeEmail(campaign.email, subject, html, text);
}

// ── Message 4: Payment confirmed ─────────────────────────────────────────────

export async function sendPaymentConfirmation(campaign: {
  contactName?: string | null;
  email: string;
  businessName: string;
  homesCount: number;
  priceCents: number;
}) {
  const firstName = firstNameFrom(campaign.contactName);
  const businessName = textValue(campaign.businessName, "your business");
  const amount = (campaign.priceCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const subject = `Payment confirmed — your campaign is in motion`;
  const html = `
    <p>Hey ${escapeHtml(firstName)},</p>
    <p>Your payment of <strong>${escapeHtml(amount)}</strong> is confirmed. Your targeted campaign for <strong>${escapeHtml(businessName)}</strong> is officially in the HomeReach production queue.</p>
    <p>Here's what's happening next:</p>
    <ol style="color:#374151;font-size:15px;line-height:1.8">
      <li>Our design team will create a custom postcard for your business</li>
      <li>We will send you a preview for approval</li>
      <li>Once approved, we print and mail to ${campaign.homesCount.toLocaleString()} homes around you</li>
    </ol>
    <p>Expect to hear from us within 2–3 business days with a design preview.</p>
    <p>Thank you for trusting HomeReach with your local visibility.</p>
  `;
  const text = `Payment confirmed. Your campaign for ${businessName} is in the HomeReach queue. We will send a design preview in 2-3 business days.`;

  return safeEmail(campaign.email, subject, html, text);
}

// ── Message 5: Design started ─────────────────────────────────────────────────

export async function sendDesignStartedNotification(campaign: {
  contactName?: string | null;
  email: string;
  businessName: string;
}) {
  const firstName = firstNameFrom(campaign.contactName);
  const businessName = textValue(campaign.businessName, "your business");

  const subject = `Your postcard design is in progress`;
  const html = `
    <p>Hey ${escapeHtml(firstName)},</p>
    <p>Our design team has started working on the postcard for <strong>${escapeHtml(businessName)}</strong>.</p>
    <p>You will receive a design preview for approval shortly, so you stay in control before anything moves to production.</p>
  `;
  const text = `Hi ${firstName}, your HomeReach postcard design is in progress. You will receive an approval preview soon.`;

  return safeEmail(campaign.email, subject, html, text);
}

// ── Message 6: Mailed notification ───────────────────────────────────────────

export async function sendMailedNotification(campaign: {
  contactName?: string | null;
  email: string;
  phone?: string | null;
  businessName: string;
  homesCount: number;
}) {
  const firstName = firstNameFrom(campaign.contactName);
  const businessName = textValue(campaign.businessName, "your business");
  const homesCount = campaign.homesCount.toLocaleString();

  const subject = `📬 Your postcards are in the mail!`;
  const html = `
    <p>Hey ${escapeHtml(firstName)},</p>
    <p>Great news: your postcards for <strong>${escapeHtml(businessName)}</strong> are officially in the mail.</p>
    <p>We have sent your postcards to <strong>${escapeHtml(homesCount)} homes</strong> in your target area. Homeowners should start receiving them over the next few days.</p>
    <p>Keep an eye on calls, messages, and search activity. The important part is that your business is now showing up where local decisions happen.</p>
    <p>The HomeReach Team</p>
  `;
  const text = `Your HomeReach postcards are in the mail. ${homesCount} homes in your target area will receive them soon.`;

  await safeEmail(campaign.email, subject, html, text);

  if (campaign.phone) {
    await safeSms(
      campaign.phone,
      `${firstName}, your HomeReach postcards are in the mail to ${homesCount} homes. Your local visibility campaign is now moving. - HomeReach`
    );
  }
}

// ── Message 7: Review request ────────────────────────────────────────────────

export async function sendReviewRequest(campaign: {
  contactName?: string | null;
  email: string;
  phone?: string | null;
  businessName: string;
}) {
  const firstName = firstNameFrom(campaign.contactName);
  const businessName = textValue(campaign.businessName, "your business");
  const reviewUrl = safeUrl(process.env.GOOGLE_REVIEW_URL ?? "https://g.page/r/homereach/review");

  const subject = `How did we do? 🌟`;
  const html = `
    <p>Hey ${escapeHtml(firstName)},</p>
    <p>Your campaign for <strong>${escapeHtml(businessName)}</strong> is underway. We hope HomeReach has made the process feel simple and confidence-building.</p>
    <p>If you have had a good experience, we would appreciate a quick review. It helps other local business owners know they are not figuring this out alone:</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${escapeHtml(reviewUrl)}" style="background:#f59e0b;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:bold">⭐ Leave a Review</a>
    </p>
    <p>Thank you so much for choosing HomeReach!</p>
    <p>— The HomeReach Team</p>
  `;
  const text = `Hi ${firstName}, hope HomeReach made your campaign feel simple and clear. We would appreciate a quick review: ${reviewUrl}`;

  await safeEmail(campaign.email, subject, html, text);

  if (campaign.phone) {
    await safeSms(
      campaign.phone,
      `Hi ${firstName}, hope HomeReach made your campaign feel simple and clear. We would appreciate a quick review: ${reviewUrl}`
    );
  }
}

// ── Admin: campaign needs attention (any internal alert) ─────────────────────

export async function notifyAdminCampaignPaid(campaign: {
  businessName: string;
  email: string;
  targetCity?: string | null;
  campaignId: string;
}) {
  const adminEmail = getAdminEmail();
  const baseUrl = safeUrl(getBaseUrl());
  const adminCampaignsUrl = `${baseUrl}/admin/targeted-campaigns`;
  const businessName = textValue(campaign.businessName, "Unknown business");

  const subject = subjectValue(`Payment received: ${businessName}`);
  const html = `
    <h2 style="color:#059669">Payment Received!</h2>
    <p><strong>${escapeHtml(businessName)}</strong> (${escapeHtml(campaign.email)}) has paid for their targeted route campaign.</p>
    <p>Target city: ${escapeHtml(campaign.targetCity, "—")}</p>
    <p style="margin-top:16px">
      <a href="${escapeHtml(adminCampaignsUrl)}" style="background:#059669;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Queue Design Job</a>
    </p>
  `;

  return safeEmail(adminEmail, subject, html, `Payment received from ${businessName} (${textValue(campaign.email)}). Queue design job.`);
}
