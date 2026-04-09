import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db, orders, bundles, businesses } from "@homereach/db";
import { eq, and } from "drizzle-orm";
import { createCheckoutSession } from "@homereach/services/stripe";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stripe/checkout
// Creates a Stripe Checkout session and an Order record in pending status.
// The webhook will activate the order on payment.success.
// ─────────────────────────────────────────────────────────────────────────────

const CheckoutSchema = z.object({
  bundleId: z.string().uuid(),
  addonIds: z.array(z.string().uuid()).optional().default([]),
  businessId: z.string().uuid().optional(), // existing business
  // If no businessId, create a new business from these fields:
  businessName: z.string().min(1).optional(),
  phone: z.string().optional(),
  cityId: z.string().uuid(),
  categoryId: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
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

    const { bundleId, addonIds, businessId, businessName, phone, cityId, categoryId } =
      parsed.data;

    // ── Fetch bundle ──────────────────────────────────────────────────────────
    const [bundle] = await db
      .select()
      .from(bundles)
      .where(eq(bundles.id, bundleId))
      .limit(1);

    if (!bundle || !bundle.isActive) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    // ── Resolve or create business — IDEMPOTENT ──────────────────────────────
    // If a pending business already exists for this user + city + category,
    // reuse it rather than creating a duplicate. This prevents double-records
    // on form retries or back-button re-submits.
    let resolvedBusinessId = businessId;

    if (!resolvedBusinessId) {
      if (!businessName) {
        return NextResponse.json(
          { error: "businessName required when creating a new business" },
          { status: 400 }
        );
      }

      // Check for an existing pending business for this user+city+category
      const [existing] = await db
        .select({ id: businesses.id })
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

      if (existing) {
        resolvedBusinessId = existing.id;
      } else {
        const [newBusiness] = await db
          .insert(businesses)
          .values({
            ownerId:    user.id,
            name:       businessName,
            phone:      phone ?? null,
            cityId,
            categoryId,
            status:     "pending",
          })
          .returning({ id: businesses.id });

        resolvedBusinessId = newBusiness!.id;
      }
    }

    // ── Calculate total (bundle price + addons) ───────────────────────────────
    // TODO Phase 2: add addon price lookup
    const total = Number(bundle.price);
    const priceInCents = Math.round(total * 100);
    // NOTE: priceInCents is only used for mode:"payment" (one-time).
    // If billing switches to mode:"subscription", remove this and use a Stripe Price ID instead.
    // See packages/services/src/stripe/index.ts for full migration instructions.

    // ── Create order record — IDEMPOTENT ──────────────────────────────────────
    // If a pending order already exists for this business + bundle (no session
    // yet), reuse it. This prevents orphaned orders on retries.
    const [existingOrder] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.businessId, resolvedBusinessId),
          eq(orders.bundleId,   bundleId),
          eq(orders.status,     "pending")
        )
      )
      .limit(1);

    let orderId: string;

    if (existingOrder) {
      orderId = existingOrder.id;
    } else {
      const [order] = await db
        .insert(orders)
        .values({
          businessId: resolvedBusinessId,
          bundleId,
          status:    "pending",
          subtotal:  bundle.price,
          total:     bundle.price.toString(),
        })
        .returning({ id: orders.id });
      orderId = order!.id;
    }

    // ── Create Stripe Checkout session ────────────────────────────────────────
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";

    const session = await createCheckoutSession({
      orderId,
      bundleId,
      addonIds,
      businessName: businessName ?? resolvedBusinessId,
      cityId,
      categoryId,
      email: user.email!,
      priceInCents,
      successUrl: `${appUrl}/checkout/success?order=${orderId}`,
      cancelUrl: `${appUrl}/get-started`,
    });

    // Store checkout session ID on the order for webhook correlation
    await db
      .update(orders)
      .set({ stripeCheckoutSessionId: session.id })
      .where(eq(orders.id, orderId));

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[/api/stripe/checkout]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
