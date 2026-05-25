import { NextResponse } from "next/server";
import { z } from "zod";
import { db, waitlistEntries } from "@homereach/db";
import {
  checkPublicRateLimit,
  publicRateLimitHeaders,
} from "@/lib/security/public-rate-limit";

const WaitlistSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  businessName: z.string().min(1).optional(),
  phone: z.string().optional(),
  cityId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
});

const WAITLIST_RATE_LIMIT = {
  scope: "lead-capture:waitlist",
  limit: 20,
  windowMs: 5 * 60_000,
};

export async function POST(req: Request) {
  const rateLimit = checkPublicRateLimit(req, WAITLIST_RATE_LIMIT);
  const headers = publicRateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many waitlist requests." },
      { status: 429, headers }
    );
  }

  try {
    const body = await req.json();
    const parsed = WaitlistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers }
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

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    console.error("[/api/waitlist]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  }
}
