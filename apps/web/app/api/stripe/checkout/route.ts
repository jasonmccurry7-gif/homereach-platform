import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db, orders, businesses } from "@homereach/db";
import { and, eq } from "drizzle-orm";
import { createCheckoutSession } from "@homereach/services/stripe";
import { getBundlesWithAvailability } from "@/lib/funnel/queries";
import { checkCanonicalAvailability } from "@/lib/spots/canonical-availability";
import { checkRateLimit } from "@/lib/security/rate-limit";

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

    const limited = checkRateLimit(req, {
      key: "shared-checkout-create",
      limit: 10,
      windowMs: 10 * 60 * 1000,
      identifier: user.id,
    });
    if (limited) return limited;

    const body = await req.json();
    const parsed = CheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { bundleId, addonIds, businessId, businessName, cityId, categoryId } =
      parsed.data;

    if (addonIds.length > 0) {
      return NextResponse.json(
        {
          error:
            "Add-ons are not available in this checkout flow until server-side add-on pricing is enabled.",
        },
        { status: 400 },
      );
    }

    const availableBundles = await getBundlesWithAvailability(cityId, categoryId);
    const bundle = availableBundles.find((candidate) => candidate.id === bundleId);

    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    if (bundle.isSoldOut || bundle.spotsRemaining <= 0) {
      return NextResponse.json(
        {
          error:
            "This bundle is no longer available for the selected city and category. Please choose another option or join the waitlist.",
        },
        { status: 409 }
      );
    }

    const availability = await checkCanonicalAvailability({ cityId, categoryId });
    if (!availability.available) {
      return NextResponse.json(
        {
          error:
            availability.message ??
            "This spot is no longer available. Join the waitlist to be notified when it opens.",
          source: availability.source,
        },
        { status: 409 }
      );
    }

    // ── Resolve or create business ────────────────────────────────────────────
    let resolvedBusinessId = businessId;

    if (resolvedBusinessId) {
      const [existingBusiness] = await db
        .select({
          id: businesses.id,
          ownerId: businesses.ownerId,
          cityId: businesses.cityId,
          categoryId: businesses.categoryId,
          name: businesses.name,
        })
        .from(businesses)
        .where(
          and(
            eq(businesses.id, resolvedBusinessId),
            eq(businesses.ownerId, user.id)
          )
        )
        .limit(1);

      if (!existingBusiness) {
        return NextResponse.json({ error: "Business not found" }, { status: 404 });
      }

      if (existingBusiness.cityId !== cityId || existingBusiness.categoryId !== categoryId) {
        return NextResponse.json(
          { error: "Business does not match the requested city/category" },
          { status: 400 }
        );
      }
    } else {
      if (!businessName) {
        return NextResponse.json(
          { error: "businessName required when creating a new business" },
          { status: 400 }
        );
      }

      const [newBusiness] = await db
        .insert(businesses)
        .values({
          ownerId: user.id,
          name: businessName,
          cityId,
          categoryId,
          status: "pending",
        })
        .returning({ id: businesses.id });

      resolvedBusinessId = newBusiness!.id;
    }

    // ── Calculate total (bundle price + addons) ───────────────────────────────
    // TODO Phase 2: add addon price lookup
    const total = Number(bundle.price);
    const priceInCents = Math.round(total * 100);

    // ── Create order record ───────────────────────────────────────────────────
    const [order] = await db
      .insert(orders)
      .values({
        businessId: resolvedBusinessId,
        bundleId,
        status: "pending",
        subtotal: bundle.price,
        total: bundle.price.toString(),
      })
      .returning({ id: orders.id });

    const orderId = order!.id;

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
