import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db, spotAssignments, businesses, cities, categories } from "@homereach/db";
import { eq, and, inArray } from "drizzle-orm";
import { createSubscriptionCheckoutSession } from "@homereach/services/stripe";
import { snapshotPrice } from "@homereach/services/pricing";
import type { SpotType } from "@homereach/types";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/spots/checkout
//
// Creates a pending spot_assignment (reserves the slot) then returns a
// Stripe subscription checkout URL. If payment is abandoned, the pending
// row is cleaned up by a cron job (future) or admin override.
//
// REQUIRES: Migration 15 (spot_assignments table must exist)
// ─────────────────────────────────────────────────────────────────────────────

const CheckoutSchema = z.object({
  cityId:        z.string().uuid(),
  categoryId:    z.string().uuid(),
  spotType:      z.enum(["anchor", "front_feature", "back_feature", "full_card"]),
  // Business identification
  businessId:    z.string().uuid().optional(), // existing business
  businessName:  z.string().min(1).optional(), // new business (if no businessId)
  phone:         z.string().optional(),
  // Commitment acknowledgment — must be true or we reject
  commitmentAcknowledged: z.literal(true, {
    errorMap: () => ({ message: "You must acknowledge the 3-month commitment to proceed." }),
  }),
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { cityId, categoryId, spotType, businessId, businessName, phone } = parsed.data;

    // ── 1. Verify slot is available ───────────────────────────────────────────
    const [existing] = await db
      .select({ id: spotAssignments.id })
      .from(spotAssignments)
      .where(
        and(
          eq(spotAssignments.cityId,     cityId),
          eq(spotAssignments.categoryId, categoryId),
          inArray(spotAssignments.status, ["pending", "active"])
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "This spot is no longer available. Someone just claimed it." },
        { status: 409 }
      );
    }

    // ── 2. Validate city exists ───────────────────────────────────────────────
    const [cityRecord] = await db
      .select({ id: cities.id, foundingEligible: cities.foundingEligible })
      .from(cities)
      .where(eq(cities.id, cityId))
      .limit(1);

    if (!cityRecord) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    // ── 3. Resolve or create business ─────────────────────────────────────────
    let resolvedBusinessId = businessId;
    let resolvedBusinessEmail = user.email;

    if (!resolvedBusinessId) {
      if (!businessName) {
        return NextResponse.json(
          { error: "businessName required when no businessId provided" },
          { status: 400 }
        );
      }

      // Idempotent — reuse pending business for this user+city+category if it exists
      const [existingBiz] = await db
        .select({ id: businesses.id, email: businesses.email })
        .from(businesses)
        .where(
          and(
            eq(businesses.ownerId,    user.id),
            eq(businesses.cityId,     cityId),
            eq(businesses.categoryId, categoryId),
            eq(businesses.status,     "pending")
          )
        )
        .limit(1);

      if (existingBiz) {
        resolvedBusinessId    = existingBiz.id;
        resolvedBusinessEmail = existingBiz.email ?? user.email;
      } else {
        const [newBiz] = await db
          .insert(businesses)
          .values({
            ownerId:    user.id,
            name:       businessName,
            phone:      phone ?? null,
            email:      user.email,
            cityId,
            categoryId,
            status:     "pending",
          })
          .returning({ id: businesses.id, email: businesses.email });

        resolvedBusinessId    = newBiz!.id;
        resolvedBusinessEmail = newBiz!.email ?? user.email;
      }
    } else {
      // Look up email for existing business
      const [biz] = await db
        .select({ email: businesses.email })
        .from(businesses)
        .where(eq(businesses.id, resolvedBusinessId))
        .limit(1);
      resolvedBusinessEmail = biz?.email ?? user.email;
    }

    // ── 4. Derive military discount server-side (never trust client) ──────────
    const [bizRecord] = await db
      .select({ isMilitary: businesses.isMilitary, stripeCustomerId: businesses.stripeCustomerId })
      .from(businesses)
      .where(eq(businesses.id, resolvedBusinessId!))
      .limit(1);

    // ── 5. Snapshot authoritative price ───────────────────────────────────────
    const snapshot = await snapshotPrice(
      {
        productType:     "spot",
        billingInterval: "monthly",
        cityId,
        spotType:        spotType as SpotType,
        isFounding:      cityRecord.foundingEligible,
      },
      {
        isVerifiedMilitary: bizRecord?.isMilitary ?? false,
        spotCountInCart:    1,
      }
    );

    // ── 6. Create pending spot_assignment (reserves the slot) ─────────────────
    const [assignment] = await db
      .insert(spotAssignments)
      .values({
        businessId:       resolvedBusinessId!,
        cityId,
        categoryId,
        spotType:         spotType as SpotType,
        status:           "pending",
        monthlyValueCents: snapshot.finalPriceCents,
      })
      .returning({ id: spotAssignments.id });

    if (!assignment) {
      return NextResponse.json({ error: "Failed to reserve spot" }, { status: 500 });
    }

    // ── 7. Create Stripe subscription checkout session ─────────────────────────
    // resolvedBusinessEmail is always set: initialized to user.email (verified non-null
    // at the top of this handler via the 401 guard), and any DB-lookup path falls
    // back to user.email. Belt-and-suspenders: fall back to user.email once more
    // here rather than using a non-null assertion.
    const session = await createSubscriptionCheckoutSession(
      {
        businessId:      resolvedBusinessId!,
        cityId,
        categoryId,
        reservationId:   assignment.id,  // spot_assignment.id doubles as reservationId
        spotIds:         [assignment.id],
        productType:     "spot",
        spotType:        spotType as SpotType,
        isFounding:      cityRecord.foundingEligible,
        isVerifiedMilitary: bizRecord?.isMilitary ?? false,
        email:           resolvedBusinessEmail ?? user.email,
      },
      snapshot
    );

    return NextResponse.json(
      { checkoutUrl: session.url, spotAssignmentId: assignment.id },
      { status: 200 }
    );

  } catch (err) {
    console.error("[api/spots/checkout] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
