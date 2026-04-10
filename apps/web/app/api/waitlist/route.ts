import { NextResponse } from "next/server";
import { z } from "zod";
import { db, waitlistEntries } from "@homereach/db";

const WaitlistSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  businessName: z.string().min(1).optional(),
  phone: z.string().optional(),
  cityId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = WaitlistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, name, businessName, phone, cityId, categoryId } = parsed.data;

    await db
      .insert(waitlistEntries)
      .values({
        email,
        name: name ?? null,
        businessName: businessName ?? null,
        phone: phone ?? null,
        cityId: cityId ?? null,
        categoryId: categoryId ?? null,
      })
      .onConflictDoNothing(); // idempotent — safe to resubmit

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[/api/waitlist]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
