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
  return process.env.NEXT_PUBLIC_BASE_URL ?? "https://homereach.com";
}

function getFromName(): string {
  return getDefaultEmailIdentity().fromName;
}

// ── Helper: safe send (never throws, always logs) ─────────────────────────────

async function safeEmail(to: string, subject: string, html: string, text: string) {
  console.log(`[targeted/messaging] email → ${to} | ${subject}`);
  try {
    const emailIdentity = getDefaultEmailIdentity();
    const result = await sendEmail({
      to,
      subject,
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
  console.log(`[targeted/messaging] sms → ${to}`);
  try {
    const result = await sendSms({ to, body });
    if (!result.success) {
      console.error(`[targeted/messaging] sms failed: ${result.error}`);
    }
    return result;
  } catch (err) {
    console.error(`[targeted/messaging] sms exception:`, err);
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
  const name = lead.name ?? lead.businessName ?? "Unknown";
  const baseUrl = getBaseUrl();

  const subject = `🔔 New Lead: ${name}`;
  const html = `
    <h2 style="color:#1d4ed8">New Targeted Campaign Lead</h2>
    <table style="border-collapse:collapse;font-size:14px">
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Name</td><td><strong>${lead.name ?? "—"}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Business</td><td>${lead.businessName ?? "—"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Email</td><td>${lead.email ?? "—"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Phone</td><td>${lead.phone ?? "—"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">City</td><td>${lead.city ?? "—"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Source</td><td>${lead.source}</td></tr>
    </table>
    <p style="margin-top:16px">
      <a href="${baseUrl}/admin/targeted-campaigns" style="background:#1d4ed8;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">View in Admin</a>
    </p>
  `;
  const text = `New lead: ${name} | ${lead.email ?? "no email"} | ${lead.phone ?? "no phone"} | ${lead.city ?? "no city"} | Source: ${lead.source}`;

  await safeEmail(adminEmail, subject, html, text);

  if (adminPhone) {
    await safeSms(adminPhone, `🔔 New HomeReach lead: ${name} (${lead.source}) - ${lead.phone ?? lead.email ?? "no contact"}`);
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
  const intakeUrl = `${baseUrl}/targeted/intake?token=${lead.intakeToken}`;
  const firstName = lead.name?.split(" ")[0] ?? "there";
  const signature = buildOwnerSignature();

  const subject = `Your HomeReach Campaign Setup — 5-minute form`;
  const html = `
    <p style="font-size:16px">Hey ${firstName},</p>
    <p>Thanks for your interest in HomeReach! We're excited to help you reach homeowners right around your business.</p>
    <p>To get your campaign started, just fill out this quick form (takes about 5 minutes):</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${intakeUrl}" style="background:#1d4ed8;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:bold">Set Up My Campaign →</a>
    </p>
    <p style="color:#6b7280;font-size:13px">Link: <a href="${intakeUrl}">${intakeUrl}</a></p>
    <p>Once we have your info, we'll handle everything — design, printing, and delivery to ~500 homes around you.</p>
    <p>Any questions? Just reply to this email.</p>
    <p>${signature.replace(/\n/g, "<br>")}</p>
  `;
  const text = `Hey ${firstName}, here's your intake link: ${intakeUrl}\n\nFill it out (5 min) and we'll handle the rest.\n\n${signature}`;

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
  const intakeUrl = `${baseUrl}/targeted/intake?token=${lead.intakeToken}`;
  const firstName = lead.name?.split(" ")[0] ?? "there";

  const subject = `Quick reminder — your HomeReach campaign setup`;
  const html = `
    <p>Hey ${firstName}, just a quick reminder — your campaign setup form is waiting!</p>
    <p>It only takes a few minutes and we can't get started without it:</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${intakeUrl}" style="background:#1d4ed8;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:bold">Complete My Setup →</a>
    </p>
    <p style="color:#6b7280;font-size:13px">Or copy this link: ${intakeUrl}</p>
    <p>Reply if you have any questions — we're here to help.</p>
  `;
  const text = `Hey ${firstName}, reminder: complete your intake at ${intakeUrl}`;

  await safeEmail(lead.email, subject, html, text);

  if (lead.phone) {
    await safeSms(
      lead.phone,
      `Hi ${firstName}! Quick reminder to complete your HomeReach setup: ${intakeUrl}`
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
  const baseUrl = getBaseUrl();

  const subject = `📋 Intake Complete: ${campaign.businessName}`;
  const html = `
    <h2 style="color:#1d4ed8">Intake Form Received</h2>
    <p><strong>${campaign.businessName}</strong> has completed their intake form and is ready to pay.</p>
    <table style="border-collapse:collapse;font-size:14px;margin-top:12px">
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Contact</td><td>${campaign.contactName ?? "—"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Email</td><td>${campaign.email}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Phone</td><td>${campaign.phone ?? "—"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Address</td><td>${campaign.businessAddress ?? "—"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Target City</td><td>${campaign.targetCity ?? "—"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Target Area</td><td>${campaign.targetAreaNotes ?? "—"}</td></tr>
    </table>
    <p style="margin-top:16px">
      <a href="${baseUrl}/admin/targeted-campaigns" style="background:#059669;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">View Campaign</a>
    </p>
  `;

  return safeEmail(adminEmail, subject, html, `Intake complete: ${campaign.businessName} | ${campaign.email} | ${campaign.targetCity}`);
}

// ── Message 3b: Intake submitted — confirmation to customer ──────────────────

export async function sendIntakeConfirmationToCustomer(campaign: {
  contactName?: string | null;
  email: string;
  businessName: string;
  campaignId: string;
}) {
  const firstName = campaign.contactName?.split(" ")[0] ?? "there";
  const baseUrl = getBaseUrl();
  const checkoutUrl = `${baseUrl}/targeted/checkout?campaign=${campaign.campaignId}`;

  const subject = `We got your info — here's your checkout link`;
  const html = `
    <p>Hey ${firstName},</p>
    <p>We've received your campaign details for <strong>${campaign.businessName}</strong>. You're one step away from reaching 500 homeowners near you!</p>
    <p>Click below to complete your payment and get started:</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${checkoutUrl}" style="background:#1d4ed8;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:bold">Complete Payment → $400/mo</a>
    </p>
    <p>What happens next:</p>
    <ul style="color:#374151;font-size:14px">
      <li>✅ Our design team creates your postcard</li>
      <li>✅ You approve the design</li>
      <li>✅ We print, stamp, and mail to 500 homes around you</li>
    </ul>
    <p>Questions? Just reply to this email.</p>
  `;
  const text = `Hey ${firstName}, complete your payment here: ${checkoutUrl}`;

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
  const firstName = campaign.contactName?.split(" ")[0] ?? "there";
  const amount = (campaign.priceCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const subject = `Payment confirmed — your campaign is on its way!`;
  const html = `
    <p>Hey ${firstName},</p>
    <p>Your payment of <strong>${amount}</strong> is confirmed. Your targeted campaign for <strong>${campaign.businessName}</strong> is officially in the queue.</p>
    <p>Here's what's happening next:</p>
    <ol style="color:#374151;font-size:15px;line-height:1.8">
      <li>Our design team will create a custom postcard for your business</li>
      <li>We'll send you a preview for approval</li>
      <li>Once approved, we print and mail to ${campaign.homesCount.toLocaleString()} homes around you</li>
    </ol>
    <p>Expect to hear from us within 2–3 business days with a design preview.</p>
    <p>Thank you for choosing HomeReach! 🏡</p>
  `;
  const text = `Payment confirmed! Your campaign for ${campaign.businessName} is in the queue. We'll send a design preview in 2–3 business days.`;

  return safeEmail(campaign.email, subject, html, text);
}

// ── Message 5: Design started ─────────────────────────────────────────────────

export async function sendDesignStartedNotification(campaign: {
  contactName?: string | null;
  email: string;
  businessName: string;
}) {
  const firstName = campaign.contactName?.split(" ")[0] ?? "there";

  const subject = `Your postcard design is in progress`;
  const html = `
    <p>Hey ${firstName},</p>
    <p>Just wanted to let you know — our design team has started working on your postcard for <strong>${campaign.businessName}</strong>.</p>
    <p>You'll receive a design preview for approval shortly. Keep an eye on your inbox!</p>
  `;
  const text = `Hi ${firstName}, your postcard design is in progress. Preview coming soon!`;

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
  const firstName = campaign.contactName?.split(" ")[0] ?? "there";

  const subject = `📬 Your postcards are in the mail!`;
  const html = `
    <p>Hey ${firstName},</p>
    <p>Great news — your postcards for <strong>${campaign.businessName}</strong> are officially in the mail!</p>
    <p>We've sent your postcards to <strong>${campaign.homesCount.toLocaleString()} homes</strong> in your target area. Homeowners should start receiving them over the next few days.</p>
    <p>Keep an eye on your calls and messages — new customers are on the way! 🏡</p>
    <p>— The HomeReach Team</p>
  `;
  const text = `Your HomeReach postcards are in the mail! ${campaign.homesCount.toLocaleString()} homes in your target area will receive them soon.`;

  await safeEmail(campaign.email, subject, html, text);

  if (campaign.phone) {
    await safeSms(
      campaign.phone,
      `📬 ${firstName}, your HomeReach postcards are in the mail to ${campaign.homesCount.toLocaleString()} homes! New customers coming your way. - HomeReach`
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
  const firstName = campaign.contactName?.split(" ")[0] ?? "there";
  const reviewUrl = process.env.GOOGLE_REVIEW_URL ?? "https://g.page/r/homereach/review";

  const subject = `How did we do? 🌟`;
  const html = `
    <p>Hey ${firstName},</p>
    <p>Your campaign for <strong>${campaign.businessName}</strong> is underway — we hope the calls and leads are already coming in!</p>
    <p>If you've had a good experience with HomeReach, we'd love a quick review. It only takes 30 seconds and helps us a lot:</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${reviewUrl}" style="background:#f59e0b;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:bold">⭐ Leave a Review</a>
    </p>
    <p>Thank you so much for choosing HomeReach!</p>
    <p>— The HomeReach Team</p>
  `;
  const text = `Hi ${firstName}, hope your HomeReach campaign is going well! Would love a quick review: ${reviewUrl}`;

  await safeEmail(campaign.email, subject, html, text);

  if (campaign.phone) {
    await safeSms(
      campaign.phone,
      `Hi ${firstName}! Hope the HomeReach campaign is bringing in customers. Would love a quick review: ${reviewUrl}`
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
  const baseUrl = getBaseUrl();

  const subject = `💰 Payment received: ${campaign.businessName}`;
  const html = `
    <h2 style="color:#059669">Payment Received!</h2>
    <p><strong>${campaign.businessName}</strong> (${campaign.email}) has paid for their targeted route campaign.</p>
    <p>Target city: ${campaign.targetCity ?? "—"}</p>
    <p style="margin-top:16px">
      <a href="${baseUrl}/admin/targeted-campaigns" style="background:#059669;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Queue Design Job</a>
    </p>
  `;

  return safeEmail(adminEmail, subject, html, `Payment received from ${campaign.businessName} (${campaign.email}). Queue design job.`);
}
