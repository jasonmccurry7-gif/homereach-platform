import { NextResponse } from "next/server";
import { db, intakeSubmissions, businesses } from "@homereach/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendEmail } from "@homereach/services/outreach";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/intake/[token]
//
// Submits the intake form for the shared postcard product.
// Looks up the intake_submission by access_token, validates, updates record.
//
// No authentication required — the access_token in the URL is the auth mechanism.
// ─────────────────────────────────────────────────────────────────────────────

const SubmitSchema = z.object({
  serviceArea:     z.string().min(1, "Service area is required"),
  targetCustomer:  z.string().min(1, "Target customer is required"),
  keyOffer:        z.string().min(1, "Key offer is required"),
  differentiators: z.string().min(1, "Differentiators are required"),
  additionalNotes: z.string().optional(),
});

interface Params {
  params: Promise<{ token: string }>;
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params;

    const body = await req.json();
    const parsed = SubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Look up intake submission by access token
    const [record] = await db
      .select({
        id:         intakeSubmissions.id,
        status:     intakeSubmissions.status,
        businessId: intakeSubmissions.businessId,
      })
      .from(intakeSubmissions)
      .where(eq(intakeSubmissions.accessToken, token))
      .limit(1);

    if (!record) {
      return NextResponse.json({ error: "Intake form not found." }, { status: 404 });
    }

    if (record.status === "submitted" || record.status === "reviewed") {
      return NextResponse.json(
        { error: "This form has already been submitted." },
        { status: 409 }
      );
    }

    // Update intake submission
    await db
      .update(intakeSubmissions)
      .set({
        serviceArea:     parsed.data.serviceArea,
        targetCustomer:  parsed.data.targetCustomer,
        keyOffer:        parsed.data.keyOffer,
        differentiators: parsed.data.differentiators,
        additionalNotes: parsed.data.additionalNotes ?? null,
        status:          "submitted",
        submittedAt:     new Date(),
        updatedAt:       new Date(),
      })
      .where(eq(intakeSubmissions.id, record.id));

    // Notify admin
    const [biz] = await db
      .select({ name: businesses.name, email: businesses.email })
      .from(businesses)
      .where(eq(businesses.id, record.businessId))
      .limit(1);

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? process.env.ADMIN_EMAILS?.split(",")[0];

    if (adminEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";

      await sendEmail({
        to:      adminEmail,
        subject: `[HomeReach] Intake Submitted — ${biz?.name ?? "Unknown Business"}`,
        html: `
          <h2>New Intake Form Submitted</h2>
          <p><strong>Business:</strong> ${biz?.name ?? "Unknown"}</p>
          <p><strong>Email:</strong> ${biz?.email ?? "Unknown"}</p>
          <p><strong>Service Area:</strong> ${parsed.data.serviceArea}</p>
          <p><strong>Target Customer:</strong> ${parsed.data.targetCustomer}</p>
          <p><strong>Key Offer:</strong> ${parsed.data.keyOffer}</p>
          <p><strong>Differentiators:</strong> ${parsed.data.differentiators}</p>
          ${parsed.data.additionalNotes ? `<p><strong>Notes:</strong> ${parsed.data.additionalNotes}</p>` : ""}
          <p><a href="${appUrl}/admin/intake">Review in Admin →</a></p>
        `,
      }).catch((err) => console.error("[api/intake] admin notification error:", err));
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    console.error("[api/intake/[token]] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
