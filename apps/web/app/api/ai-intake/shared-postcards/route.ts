import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAiIntakeAgentEnabled } from "@/lib/ai-intake/env";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  AI_INTAKE_TERM_MONTHS,
  addAiCartItems,
  appendAiIntakeMessage,
  createAiIntakeSession,
  formatCents,
  loadAiIntakeOptions,
  loadAiIntakeState,
  missingRequiredDetails,
  placementToSpotType,
  syncAiIntakeTotals,
  validateCartAvailability,
  type AiCartItemView,
  type AiPlacementType,
} from "@/lib/ai-intake/shared-postcard-cart";

const PlacementSchema = z.enum(["front", "back", "multiple", "full_card_exclusivity"]);

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("bootstrap"),
    sessionId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("add_item"),
    sessionId: z.string().uuid(),
    cityIds: z.array(z.string().uuid()).min(1),
    categoryIds: z.array(z.string().uuid()).min(1),
    placementType: PlacementSchema,
    quantity: z.number().int().min(1).max(12).default(1),
    militaryEligible: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("remove_item"),
    sessionId: z.string().uuid(),
    itemId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("save_details"),
    sessionId: z.string().uuid(),
    businessName: z.string().trim().min(1).max(160),
    contactName: z.string().trim().min(1).max(160),
    phone: z.string().trim().min(7).max(40),
    email: z.string().trim().email(),
    websiteUrl: z.string().trim().max(300).optional().default(""),
    facebookUrl: z.string().trim().max(300).optional().default(""),
    logoUrl: z.string().trim().max(500).optional().default(""),
    logoFileName: z.string().trim().max(180).optional().default(""),
    offerHeadline: z.string().trim().max(240).optional().default(""),
    aiGenerateOffer: z.boolean().default(false),
    militaryEligible: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("confirm"),
    sessionId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("checkout"),
    sessionId: z.string().uuid(),
  }),
]);

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

function disabledResponse() {
  return NextResponse.json({ error: "AI intake agent is disabled" }, { status: 404 });
}

async function responseWithState(sessionId: string) {
  const supa = createServiceClient();
  const [state, options] = await Promise.all([
    loadAiIntakeState(supa, sessionId),
    loadAiIntakeOptions(supa),
  ]);

  return NextResponse.json({ ...state, options });
}

function detailsSnapshot(session: Awaited<ReturnType<typeof loadAiIntakeState>>["session"]) {
  return {
    business_name: session.businessName,
    contact_name: session.contactName,
    phone: session.phone,
    email: session.email,
    website_url: session.websiteUrl,
    facebook_url: session.facebookUrl,
    logo_url: session.logoUrl,
    logo_file_name: session.logoFileName,
    offer_headline: session.offerHeadline,
    ai_generate_offer: session.aiGenerateOffer,
    military_discount_eligible: session.militaryDiscountEligible,
  };
}

async function ensureFulfillmentRecords(args: {
  userId: string;
  sessionId: string;
  item: AiCartItemView;
  session: Awaited<ReturnType<typeof loadAiIntakeState>>["session"];
}) {
  const supa = createServiceClient();

  if (args.item.businessId && args.item.orderId && args.item.spotAssignmentId) {
    return {
      businessId: args.item.businessId,
      orderId: args.item.orderId,
      spotAssignmentId: args.item.spotAssignmentId,
    };
  }

  const notesMeta = {
    source: "ai_intake_agent",
    sessionId: args.sessionId,
    cartItemId: args.item.id,
    placementType: args.item.placementType,
    quantity: args.item.quantity,
    aiGenerateOffer: args.session.aiGenerateOffer,
    offerHeadline: args.session.offerHeadline || null,
    logoUrl: args.session.logoUrl || null,
    logoFileName: args.session.logoFileName || null,
  };

  const { data: business, error: businessError } = await supa
    .from("businesses")
    .insert({
      owner_id: args.userId,
      name: args.session.businessName,
      category_id: args.item.categoryId,
      city_id: args.item.cityId,
      phone: args.session.phone,
      email: args.session.email,
      website: args.session.websiteUrl || args.session.facebookUrl || null,
      status: "pending",
      notes: `[ai_intake_meta] ${JSON.stringify(notesMeta)}`,
    })
    .select("id")
    .single();

  if (businessError || !business) {
    throw businessError ?? new Error("Could not create business record");
  }

  const { data: order, error: orderError } = await supa
    .from("orders")
    .insert({
      business_id: business.id,
      bundle_id: args.item.bundleId,
      status: "pending",
      subtotal: (args.item.subtotalCents / 100).toFixed(2),
      total: (args.item.subtotalCents / 100).toFixed(2),
    })
    .select("id")
    .single();

  if (orderError || !order) {
    throw orderError ?? new Error("Could not create pending order");
  }

  const { data: assignment, error: assignmentError } = await supa
    .from("spot_assignments")
    .insert({
      business_id: business.id,
      city_id: args.item.cityId,
      category_id: args.item.categoryId,
      spot_type: placementToSpotType(args.item.placementType),
      status: "pending",
      monthly_value_cents: args.item.subtotalCents,
      ai_intake_session_id: args.sessionId,
      ai_intake_cart_item_id: args.item.id,
      ai_reserved_spot_count: args.item.quantity,
    })
    .select("id")
    .single();

  if (assignmentError || !assignment) {
    throw assignmentError ?? new Error("Could not reserve spot assignment");
  }

  const { error: updateError } = await supa
    .from("ai_intake_cart_items")
    .update({
      business_id: business.id,
      order_id: order.id,
      spot_assignment_id: assignment.id,
      availability_status: "reserved",
      availability_message: "Reserved after checkout session creation.",
    })
    .eq("id", args.item.id);

  if (updateError) throw updateError;

  return {
    businessId: business.id as string,
    orderId: order.id as string,
    spotAssignmentId: assignment.id as string,
  };
}

async function createCheckout(sessionId: string) {
  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user?.email) {
    return NextResponse.json(
      {
        error: "Create an account before payment.",
        redirectTo: `/signup?redirect=${encodeURIComponent(`/shared-postcards/ai-intake?sessionId=${sessionId}`)}`,
      },
      { status: 401 },
    );
  }

  const supa = createServiceClient();
  let state = await loadAiIntakeState(supa, sessionId);
  if (state.session.status !== "confirmed" && state.session.status !== "checkout_created") {
    return NextResponse.json(
      { error: "Confirm the cart before payment is generated." },
      { status: 400 },
    );
  }

  const missing = missingRequiredDetails(state.session);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required details: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  if (state.cartItems.length === 0) {
    return NextResponse.json({ error: "Add at least one cart item first." }, { status: 400 });
  }

  const unreservedItems = state.cartItems.filter(
    (item) => !item.businessId || !item.orderId || !item.spotAssignmentId,
  );
  const availability = await validateCartAvailability(supa, unreservedItems);
  if (!availability.ok) {
    return NextResponse.json({ error: availability.message }, { status: 409 });
  }

  for (const item of state.cartItems) {
    await ensureFulfillmentRecords({
      userId: user.id,
      sessionId,
      item,
      session: state.session,
    });
  }

  state = await loadAiIntakeState(supa, sessionId);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = state.cartItems.map((item) => ({
    price_data: {
      currency: "usd",
      unit_amount: item.subtotalCents,
      recurring: { interval: "month" },
      product_data: {
        name: `HomeReach ${item.placementLabel} - ${item.cityName}`,
        description: `${item.categoryName} shared postcard reservation. Three-month minimum.`,
      },
    },
    quantity: 1,
  }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";
  const stripe = getStripe();
  const stripeSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    line_items: lineItems,
    metadata: {
      type: "ai_shared_postcard_intake",
      aiIntakeSessionId: sessionId,
    },
    subscription_data: {
      metadata: {
        type: "ai_shared_postcard_intake",
        aiIntakeSessionId: sessionId,
      },
    },
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&ai_intake=${sessionId}`,
    cancel_url: `${appUrl}/shared-postcards/ai-intake?sessionId=${sessionId}`,
    billing_address_collection: "auto",
    allow_promotion_codes: true,
  });

  const { error: sessionUpdateError } = await supa
    .from("ai_intake_sessions")
    .update({
      user_id: user.id,
      status: "checkout_created",
      current_step: "checkout",
      stripe_checkout_session_id: stripeSession.id,
      checkout_url: stripeSession.url,
    })
    .eq("id", sessionId);

  if (sessionUpdateError) throw sessionUpdateError;

  await supa
    .from("ai_intake_confirmations")
    .update({ confirmation_status: "checkout_created" })
    .eq("session_id", sessionId)
    .eq("confirmation_status", "confirmed");

  await appendAiIntakeMessage({
    supa,
    sessionId,
    role: "assistant",
    stepKey: "checkout",
    message: `Checkout is ready. Your monthly cart is ${formatCents(
      state.session.totalMonthlyCents,
    )} with a ${AI_INTAKE_TERM_MONTHS}-month minimum.`,
  });

  return NextResponse.json({ checkoutUrl: stripeSession.url });
}

export async function GET(req: Request) {
  if (!isAiIntakeAgentEnabled()) return disabledResponse();

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      const options = await loadAiIntakeOptions(createServiceClient());
      return NextResponse.json({ options });
    }

    return responseWithState(sessionId);
  } catch (err) {
    console.error("[ai-intake/shared-postcards GET]", err);
    return NextResponse.json({ error: "Could not load AI intake state" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isAiIntakeAgentEnabled()) return disabledResponse();

  try {
    const limited = checkRateLimit(req, {
      key: "shared-postcard-ai-intake",
      limit: 40,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = BodySchema.parse(await req.json());
    const supa = createServiceClient();

    if (body.action === "bootstrap") {
      const sessionId = body.sessionId ?? (await createAiIntakeSession(supa));
      return responseWithState(sessionId);
    }

    if (body.action === "add_item") {
      await appendAiIntakeMessage({
        supa,
        sessionId: body.sessionId,
        role: "user",
        stepKey: "cart",
        message: "Add these city/category selections to my cart.",
        payload: body,
      });

      const results = await addAiCartItems({
        supa,
        sessionId: body.sessionId,
        cityIds: body.cityIds,
        categoryIds: body.categoryIds,
        placementType: body.placementType as AiPlacementType,
        quantity: body.quantity,
        militaryEligible: body.militaryEligible,
      });

      const added = results.filter((result) => result.ok);
      const blocked = results.filter((result) => !result.ok);
      const blockedCopy =
        blocked.length > 0
          ? ` ${blocked.length} selection(s) need a different city/category because availability changed.`
          : "";

      await appendAiIntakeMessage({
        supa,
        sessionId: body.sessionId,
        role: "assistant",
        stepKey: "details",
        message:
          added.length > 0
            ? `${added.length} cart item(s) added.${blockedCopy} Next, add business details or add another city/category.`
            : `I could not add those selections.${blockedCopy}`,
        payload: { results },
      });

      return responseWithState(body.sessionId);
    }

    if (body.action === "remove_item") {
      const { error } = await supa
        .from("ai_intake_cart_items")
        .delete()
        .eq("id", body.itemId)
        .eq("session_id", body.sessionId);
      if (error) throw error;
      await syncAiIntakeTotals(supa, body.sessionId);
      await appendAiIntakeMessage({
        supa,
        sessionId: body.sessionId,
        role: "assistant",
        stepKey: "cart",
        message: "Removed that cart item and recalculated the order.",
      });
      return responseWithState(body.sessionId);
    }

    if (body.action === "save_details") {
      const { error } = await supa
        .from("ai_intake_sessions")
        .update({
          current_step: "review",
          business_name: body.businessName,
          contact_name: body.contactName,
          phone: body.phone,
          email: body.email,
          website_url: body.websiteUrl || null,
          facebook_url: body.facebookUrl || null,
          logo_url: body.logoUrl || null,
          logo_file_name: body.logoFileName || null,
          offer_headline: body.offerHeadline || null,
          ai_generate_offer: body.aiGenerateOffer,
          military_discount_requested: body.militaryEligible,
          military_discount_eligible: body.militaryEligible,
        })
        .eq("id", body.sessionId);
      if (error) throw error;

      await appendAiIntakeMessage({
        supa,
        sessionId: body.sessionId,
        role: "user",
        stepKey: "details",
        message: "Business details added.",
        payload: body,
      });
      await appendAiIntakeMessage({
        supa,
        sessionId: body.sessionId,
        role: "assistant",
        stepKey: "review",
        message: "Great. Review the cart summary, then confirm when everything looks right.",
      });
      return responseWithState(body.sessionId);
    }

    if (body.action === "confirm") {
      const state = await loadAiIntakeState(supa, body.sessionId);
      const missing = missingRequiredDetails(state.session);
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Missing required details: ${missing.join(", ")}` },
          { status: 400 },
        );
      }
      if (state.cartItems.length === 0) {
        return NextResponse.json({ error: "Add at least one cart item first." }, { status: 400 });
      }

      const availability = await validateCartAvailability(supa, state.cartItems);
      if (!availability.ok) {
        return NextResponse.json({ error: availability.message }, { status: 409 });
      }

      const sessionClient = await createClient();
      const {
        data: { user },
      } = await sessionClient.auth.getUser();

      const { error: confirmationError } = await supa.from("ai_intake_confirmations").insert({
        session_id: body.sessionId,
        confirmed_by_user_id: user?.id ?? null,
        confirmation_status: "confirmed",
        cart_snapshot: state.cartItems,
        business_snapshot: detailsSnapshot(state.session),
        total_monthly_cents: state.session.totalMonthlyCents,
        total_contract_value_cents: state.session.totalContractValueCents,
      });

      if (confirmationError) throw confirmationError;

      const { error: sessionError } = await supa
        .from("ai_intake_sessions")
        .update({ status: "confirmed", current_step: "checkout" })
        .eq("id", body.sessionId);
      if (sessionError) throw sessionError;

      await appendAiIntakeMessage({
        supa,
        sessionId: body.sessionId,
        role: "assistant",
        stepKey: "checkout",
        message: "Confirmed. Payment stays locked until you click Continue to payment.",
      });

      return responseWithState(body.sessionId);
    }

    if (body.action === "checkout") {
      return createCheckout(body.sessionId);
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err) {
    console.error("[ai-intake/shared-postcards POST]", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.flatten() }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI intake request failed" },
      { status: 500 },
    );
  }
}
