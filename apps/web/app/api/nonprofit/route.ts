// POST /api/nonprofit
// Public nonprofit registration endpoint.
// Stores application in DB + notifies admin + confirms to applicant.
// No auth required.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db, publicNonprofitApplications } from "@homereach/db";

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

export async function POST(req: Request) {
  try {
    const body   = await req.json();
    const parsed = NonprofitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
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

    const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com"}/admin/nonprofits`;

    // ── 2. Notify admin ───────────────────────────────────────────────────────
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    if (adminEmail) {
      try {
        const { sendEmail } = await import("@homereach/services/outreach");
        await sendEmail({
          to:      adminEmail,
          subject: `[HomeReach] New Nonprofit Application — ${data.orgName}`,
          html: `
            <h2>New Nonprofit Application</h2>
            ${applicationId ? `<p style="color:#666;font-size:12px;">ID: ${applicationId}</p>` : ""}
            <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
              <tr><td style="padding:8px;font-weight:bold;color:#555;">Organization</td><td style="padding:8px;">${data.orgName}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#555;">EIN</td><td style="padding:8px;">${data.ein ?? "Not provided"}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;color:#555;">Contact</td><td style="padding:8px;">${data.contactName}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#555;">Email</td><td style="padding:8px;">${data.email}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;color:#555;">Phone</td><td style="padding:8px;">${data.phone ?? "Not provided"}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#555;">City</td><td style="padding:8px;">${data.city ?? "Not provided"}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;color:#555;">Website</td><td style="padding:8px;">${data.website ?? "Not provided"}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#555;">Mission</td><td style="padding:8px;">${data.mission ?? "Not provided"}</td></tr>
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
          <p>Hi ${data.contactName},</p>
          <p>We received your application for <strong>${data.orgName}</strong>.</p>
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

    return NextResponse.json({ success: true, id: applicationId });
  } catch (err) {
    console.error("[/api/nonprofit] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
