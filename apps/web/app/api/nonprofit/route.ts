// POST /api/nonprofit
// Public nonprofit registration endpoint.
// Stores application in DB + notifies admin + confirms to applicant.
// No auth required.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db, publicNonprofitApplications } from "@homereach/db";
import { getPublicAppBaseUrl } from "@/lib/runtime/app-url";
import { cleanEmailSubjectPart } from "@/lib/security/email";
import { escapeHtml, escapeHtmlOr } from "@/lib/security/html";
import {
  checkPublicRateLimit,
  publicRateLimitHeaders,
} from "@/lib/security/public-rate-limit";

const NonprofitSchema = z.object({
  orgName:     z.string().min(1, "Organization name is required"),
  contactName: z.string().min(1, "Contact name is required"),
  email:       z.string().email("Valid email is required"),
  phone:       z.string().optional(),
  ein:         z.string().optional(),
  website:     z.string().url().optional().or(z.literal("")),
  mission:     z.string().optional(),
  city:        z.string().optional(),
});

const NONPROFIT_APPLICATION_RATE_LIMIT = {
  scope: "lead-capture:nonprofit-application",
  limit: 10,
  windowMs: 10 * 60_000,
};

export async function POST(req: Request) {
  const rateLimit = checkPublicRateLimit(req, NONPROFIT_APPLICATION_RATE_LIMIT);
  const headers = publicRateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many nonprofit application requests." },
      { status: 429, headers }
    );
  }

  try {
    const body   = await req.json();
    const parsed = NonprofitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }

    const data = parsed.data;

    // ── 1. Persist to DB ─────────────────────────────────────────────────────
    let applicationId: string | null = null;
    try {
      const [inserted] = await db
        .insert(publicNonprofitApplications)
        .values({
          orgName:     data.orgName,
          ein:         data.ein     ?? null,
          website:     data.website ?? null,
          mission:     data.mission ?? null,
          contactName: data.contactName,
          email:       data.email,
          phone:       data.phone ?? null,
          city:        data.city  ?? null,
          status:      "pending",
        })
        .returning({ id: publicNonprofitApplications.id });
      applicationId = inserted?.id ?? null;
    } catch (err) {
      // Log but don't fail the user — emails still go out
      console.error("[/api/nonprofit] DB insert failed:", err);
    }

    const adminUrl = escapeHtml(`${getPublicAppBaseUrl()}/admin/nonprofits`);
    const emailHtml = {
      orgName:     escapeHtml(data.orgName),
      contactName: escapeHtml(data.contactName),
      email:       escapeHtml(data.email),
      ein:         escapeHtmlOr(data.ein, "Not provided"),
      phone:       escapeHtmlOr(data.phone, "Not provided"),
      city:        escapeHtmlOr(data.city, "Not provided"),
      website:     escapeHtmlOr(data.website, "Not provided"),
      mission:     escapeHtmlOr(data.mission, "Not provided"),
    };

    // ── 2. Notify admin ───────────────────────────────────────────────────────
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    if (adminEmail) {
      try {
        const { sendEmail } = await import("@homereach/services/outreach");
        await sendEmail({
          to:      adminEmail,
          subject: `[HomeReach] New Nonprofit Application — ${cleanEmailSubjectPart(data.orgName)}`,
          html: `
            <h2>New Nonprofit Application</h2>
            ${applicationId ? `<p style="color:#666;font-size:12px;">ID: ${applicationId}</p>` : ""}
            <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
              <tr><td style="padding:8px;font-weight:bold;color:#555;">Organization</td><td style="padding:8px;">${emailHtml.orgName}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#555;">EIN</td><td style="padding:8px;">${emailHtml.ein}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;color:#555;">Contact</td><td style="padding:8px;">${emailHtml.contactName}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#555;">Email</td><td style="padding:8px;">${emailHtml.email}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;color:#555;">Phone</td><td style="padding:8px;">${emailHtml.phone}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#555;">City</td><td style="padding:8px;">${emailHtml.city}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;color:#555;">Website</td><td style="padding:8px;">${emailHtml.website}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#555;">Mission</td><td style="padding:8px;">${emailHtml.mission}</td></tr>
            </table>
            <p style="margin-top:16px;color:#666;">Review in <a href="${adminUrl}">Admin → Nonprofits</a></p>
          `,
        });
      } catch (err) {
        console.error("[/api/nonprofit] Failed to send admin notification:", err);
      }
    }

    // ── 3. Confirm to nonprofit ───────────────────────────────────────────────
    try {
      const { sendEmail } = await import("@homereach/services/outreach");
      await sendEmail({
        to:      data.email,
        subject: "HomeReach — Nonprofit Application Received",
        html: `
          <p>Hi ${emailHtml.contactName},</p>
          <p>We received your application for <strong>${emailHtml.orgName}</strong>.</p>
          <p>We'll verify your nonprofit status and reach out within 2 business days.
          Once approved, local businesses using HomeReach will be able to co-sponsor your cause
          — giving your nonprofit free visibility on every mailer drop in your city.</p>
          <p>If you have questions, simply reply to this email.</p>
          <p>— The HomeReach Team</p>
        `,
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ success: true, id: applicationId }, { headers });
  } catch (err) {
    console.error("[/api/nonprofit] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  }
}
