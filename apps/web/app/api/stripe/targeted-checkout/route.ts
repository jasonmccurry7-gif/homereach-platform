// POST /api/stripe/targeted-checkout
// Creates a Stripe Checkout session for a Targeted Route Campaign + optional add-ons.
// Uses Supabase JS (HTTP) — no Drizzle.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import Stripe from "stripe";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  signPublicFlowToken,
  verifyPublicFlowToken,
} from "@/lib/security/signed-token";
import {
  isTargetedHomesCount,
  resolveTargetedCampaignPriceCents,
  VALID_TARGETED_HOMES_COUNTS,
} from "@/lib/targeted/pricing";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is required");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

const TargetedAddonSchema = z.enum([
  "door_hangers",
  "fliers",
  "yard_signs",
  "business_cards",
  "website_setup",
  "website_maintenance",
  "full_automation",
  "sms_automation",
  "email_automation",
  "nonprofit",
]);

type TargetedAddon = z.infer<typeof TargetedAddonSchema>;

const TargetedCheckoutSchema = z
  .object({
    campaignId: z.string().uuid().optional(),
    checkoutToken: z.string().min(20).optional(),
    addons: z.array(TargetedAddonSchema).max(10).optional().default([]),
  })
  .strict()
  .refine((value) => Boolean(value.campaignId || value.checkoutToken), {
    message: "campaignId or checkoutToken is required",
    path: ["checkoutToken"],
  });

const AddonLineItems: Record<
  TargetedAddon,
  { unitAmount: number; name: string; description: string }
> = {
  door_hangers: {
    unitAmount: 40000,
    name: 'Door Hangers (500) - 3.5" x 8.5"',
    description:
      '500 door hangers, 3.5" x 8.5", professionally designed and printed',
  },
  fliers: {
    unitAmount: 22500,
    name: 'Fliers (500) - 8.5" x 11"',
    description: '500 full-color fliers, 8.5" x 11"',
  },
  yard_signs: {
    unitAmount: 30000,
    name: 'Yard Signs (10) - 18" x 24"',
    description: '10 branded yard signs with stakes, 18" x 24"',
  },
  business_cards: {
    unitAmount: 10500,
    name: 'Business Cards (500) - 3.5" x 2"',
    description: '500 premium business cards, standard 3.5" x 2"',
  },
  website_setup: {
    unitAmount: 49700,
    name: "Website Design (One-Time Setup)",
    description:
      "Professional mobile-friendly website designed and built for your business",
  },
  website_maintenance: {
    unitAmount: 9700,
    name: "Website Hosting & Maintenance (first month)",
    description:
      "First month access; ongoing subscription reviewed and approved separately",
  },
  full_automation: {
    unitAmount: 7900,
    name: "Full Automation Bundle (first month)",
    description:
      "First month access; ongoing subscription reviewed and approved separately",
  },
  sms_automation: {
    unitAmount: 4900,
    name: "SMS Automation (first month)",
    description:
      "First month access; ongoing subscription reviewed and approved separately",
  },
  email_automation: {
    unitAmount: 4900,
    name: "Email Automation (first month)",
    description:
      "First month access; ongoing subscription reviewed and approved separately",
  },
  nonprofit: {
    unitAmount: 2500,
    name: "Nonprofit Sponsorship (first month)",
    description:
      "First month access; ongoing subscription reviewed and approved separately",
  },
};

function normalizeAddons(addons: TargetedAddon[]) {
  const unique = Array.from(new Set(addons));
  const normalized = unique.includes("full_automation")
    ? unique.filter(
        (addon) => addon !== "sms_automation" && addon !== "email_automation",
      )
    : unique;

  return normalized.sort();
}

function addonSignature(addons: TargetedAddon[]) {
  return addons.join("|") || "base";
}

function storedAddonSignature(metadata: Stripe.Metadata | null | undefined) {
  if (metadata?.addons_signature) return metadata.addons_signature;

  const addons = metadata?.addons
    ?.split(",")
    .map((addon) => addon.trim())
    .filter(Boolean)
    .sort()
    .join("|");

  return addons || "base";
}

function addonLineItem(
  addon: TargetedAddon,
): Stripe.Checkout.SessionCreateParams.LineItem {
  const item = AddonLineItems[addon];
  return {
    price_data: {
      currency: "usd",
      unit_amount: item.unitAmount,
      product_data: {
        name: item.name,
        description: item.description,
      },
    },
    quantity: 1,
  };
}

type TargetedCheckoutTokenPayload = {
  scope: "targeted_checkout";
  campaignId: string;
  iat: number;
  exp: number;
};

function enforceSignedCheckoutTokens() {
  if (process.env.NODE_ENV === "production") {
    return process.env.REQUIRE_SIGNED_CHECKOUT_TOKENS !== "false";
  }

  return process.env.REQUIRE_SIGNED_CHECKOUT_TOKENS === "true";
}

function resolveCampaignId(input: {
  campaignId?: string | null;
  checkoutToken?: string | null;
}):
  | { ok: true; campaignId: string; checkoutToken: string | null }
  | { ok: false; error: string; status: number } {
  if (input.checkoutToken) {
    const verified = verifyPublicFlowToken<TargetedCheckoutTokenPayload>(
      input.checkoutToken,
      "targeted_checkout",
    );
    if (!verified.ok) {
      return {
        ok: false,
        error: `Invalid or expired checkout token: ${verified.reason}`,
        status: 403,
      };
    }

    const campaignId = z.string().uuid().safeParse(verified.payload.campaignId);
    if (!campaignId.success) {
      return {
        ok: false,
        error: "Invalid checkout token campaign id",
        status: 403,
      };
    }

    return {
      ok: true,
      campaignId: campaignId.data,
      checkoutToken: input.checkoutToken,
    };
  }

  if (enforceSignedCheckoutTokens() || process.env.NODE_ENV === "production") {
    return { ok: false, error: "Signed checkout token required", status: 403 };
  }

  const parsed = z.string().uuid().safeParse(input.campaignId);
  if (!parsed.success) {
    return { ok: false, error: "Invalid campaign id", status: 400 };
  }

  return {
    ok: true,
    campaignId: parsed.data,
    checkoutToken: signPublicFlowToken({
      scope: "targeted_checkout",
      campaignId: parsed.data,
    }),
  };
}

export async function GET(req: Request) {
  const limited = checkRateLimit(req, {
    key: "targeted-checkout-summary",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const url = new URL(req.url);
  const resolved = resolveCampaignId({
    campaignId: url.searchParams.get("campaignId"),
    checkoutToken: url.searchParams.get("token"),
  });

  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  const db = createServiceClient();
  const { data: campaign, error } = await db
    .from("targeted_route_campaigns")
    .select("id, status, business_name, target_city, homes_count, price_cents")
    .eq("id", resolved.campaignId)
    .single();

  if (error || !campaign) {
    return NextResponse.json(
      { error: "Campaign not found" },
      { status: 404 },
    );
  }

  const homesCount = Number(campaign.homes_count ?? 500);
  const priceCents = Number(campaign.price_cents ?? 40000);
  const validHomesCount = Number.isInteger(homesCount) && isTargetedHomesCount(homesCount);
  const authoritativePriceCents = validHomesCount
    ? resolveTargetedCampaignPriceCents(homesCount)
    : null;

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      status: campaign.status,
      businessName: campaign.business_name ?? "Your Business",
      targetCity: campaign.target_city ?? null,
      homesCount,
      priceCents,
      eligibleForCheckout:
        campaign.status === "intake_complete" &&
        validHomesCount &&
        Number.isInteger(priceCents) &&
        priceCents >= (authoritativePriceCents ?? Number.POSITIVE_INFINITY),
      checkoutToken: resolved.checkoutToken,
    },
  });
}

export async function POST(req: Request) {
  try {
    const limited = checkRateLimit(req, {
      key: "targeted-checkout-create",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = TargetedCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const resolved = resolveCampaignId({
      campaignId: parsed.data.campaignId,
      checkoutToken: parsed.data.checkoutToken,
    });
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
    }

    const { campaignId } = resolved;
    const addons = normalizeAddons(parsed.data.addons);
    const db = createServiceClient();
    const { data: campaign, error } = await db
      .from("targeted_route_campaigns")
      .select("id, status, email, business_name, homes_count, price_cents, stripe_checkout_session_id")
      .eq("id", campaignId)
      .single();

    if (error || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 },
      );
    }

    if (["paid", "mailed", "complete"].includes(campaign.status)) {
      return NextResponse.json(
        { error: "Campaign is already paid" },
        { status: 400 },
      );
    }

    if (campaign.status !== "intake_complete") {
      return NextResponse.json(
        { error: "Campaign is not eligible for checkout" },
        { status: 400 },
      );
    }

    const basePrice = Number(campaign.price_cents ?? 40000);
    if (!Number.isInteger(basePrice) || basePrice <= 0) {
      console.error("[api/stripe/targeted-checkout] invalid campaign price", {
        campaignId,
        priceCents: campaign.price_cents,
      });
      return NextResponse.json(
        { error: "Invalid campaign pricing" },
        { status: 500 },
      );
    }

    const campaignHomesCount = Number(campaign.homes_count ?? 500);
    if (!Number.isInteger(campaignHomesCount) || !isTargetedHomesCount(campaignHomesCount)) {
      return NextResponse.json(
        {
          error: `Invalid campaign household count. Expected one of: ${VALID_TARGETED_HOMES_COUNTS.join(", ")}`,
        },
        { status: 409 },
      );
    }

    const authoritativePrice = resolveTargetedCampaignPriceCents(campaignHomesCount);
    if (basePrice < authoritativePrice) {
      console.error("[api/stripe/targeted-checkout] stored price below authoritative floor", {
        campaignId,
        basePrice,
        authoritativePrice,
        homesCount: campaignHomesCount,
      });
      return NextResponse.json(
        { error: "Campaign pricing needs admin review before checkout." },
        { status: 409 },
      );
    }

    const campaignEmail = String(campaign.email ?? "").trim();
    if (!z.string().email().safeParse(campaignEmail).success) {
      return NextResponse.json(
        { error: "Campaign has an invalid email address" },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";
    const safeHomesCount = campaignHomesCount;
    const businessName =
      typeof campaign.business_name === "string" &&
      campaign.business_name.trim()
        ? campaign.business_name.trim().slice(0, 120)
        : "Your Business";

    if (campaign.stripe_checkout_session_id) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(
          campaign.stripe_checkout_session_id,
        );
        if (
          existing.url &&
          existing.status === "open" &&
          existing.payment_status === "unpaid" &&
          existing.metadata?.campaignId === campaign.id &&
          storedAddonSignature(existing.metadata) === addonSignature(addons)
        ) {
          return NextResponse.json({ url: existing.url, reused: true });
        }
      } catch (err) {
        console.warn(
          "[api/stripe/targeted-checkout] existing session could not be reused",
          err,
        );
      }
    }

    // ── Main campaign line item ───────────────────────────────────────────────
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "usd",
          unit_amount: basePrice,
          product_data: {
            name: `HomeReach Neighborhood Visibility - ${businessName}`,
            description: `Route-level neighborhood campaign reaching approximately ${safeHomesCount.toLocaleString()} homes.`,
          },
        },
        quantity: 1,
      },
    ];

    // Add-ons
    lineItems.push(...addons.map(addonLineItem));

    // ── Create Stripe session ─────────────────────────────────────────────────
    const checkoutToken = resolved.checkoutToken ?? signPublicFlowToken({
      scope: "targeted_checkout",
      campaignId: campaign.id,
    });
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: campaign.id,
        customer_email: campaignEmail,
        line_items: lineItems,
        allow_promotion_codes: true,
        metadata: {
          type: "targeted_route_campaign",
          campaignId: campaign.id,
          businessName,
          email: campaignEmail,
          addons: addons.join(","),
          addons_signature: addonSignature(addons),
        },
        payment_intent_data: {
          metadata: {
            type: "targeted_route_campaign",
            campaignId: campaign.id,
            businessName,
            email: campaignEmail,
            addons: addons.join(","),
            addons_signature: addonSignature(addons),
          },
        },
        success_url: `${appUrl}/targeted/confirmed?campaign=${campaign.id}`,
        cancel_url: `${appUrl}/targeted/checkout?token=${encodeURIComponent(checkoutToken)}&cancelled=true`,
      },
      {
        idempotencyKey: `targeted-checkout:${campaign.id}:${addonSignature(addons)}`,
      },
    );

    // Save session ID to campaign row
    const { error: updateError } = await db
      .from("targeted_route_campaigns")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", campaignId)
      .eq("status", "intake_complete");

    if (updateError) {
      throw new Error(
        `Failed to store Stripe checkout session: ${updateError.message}`,
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[api/stripe/targeted-checkout] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}
