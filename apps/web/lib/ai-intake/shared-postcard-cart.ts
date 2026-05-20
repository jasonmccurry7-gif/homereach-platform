import { createServiceClient } from "@/lib/supabase/service";
import { checkCanonicalAvailability } from "@/lib/spots/canonical-availability";
import { getSharedPostcardCitySnapshot } from "@/lib/funnel/queries";

export const AI_INTAKE_TERM_MONTHS = 3;
export const AI_INTAKE_MILITARY_DISCOUNT_RATE = 0.1;

type ServiceClient = ReturnType<typeof createServiceClient>;

export type AiPlacementType = "front" | "back" | "multiple" | "full_card_exclusivity";

export type AiIntakeCityOption = {
  id: string;
  name: string;
  state: string;
  slug: string;
  foundingEligible: boolean;
  availableSpots: number;
};

export type AiIntakeCategoryOption = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

type CityRow = {
  id: string;
  name: string;
  state: string;
  slug: string;
  is_active?: boolean;
  founding_eligible?: boolean | null;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active?: boolean;
};

type BundleRow = {
  id: string;
  name: string;
  slug: string;
  price: string | number | null;
  is_active?: boolean;
  metadata?: Record<string, unknown> | null;
  standard_price?: string | number | null;
  founding_price?: string | number | null;
};

export type AiCartItemView = {
  id: string;
  sessionId: string;
  cityId: string;
  categoryId: string;
  placementType: AiPlacementType;
  quantity: number;
  pricingTier: string;
  discountCode: string | null;
  monthlyPriceCents: number;
  termMonths: number;
  subtotalCents: number;
  availabilityStatus: string;
  availabilitySource: string | null;
  availabilityMessage: string | null;
  cityName: string;
  categoryName: string;
  placementLabel: string;
  bundleId: string | null;
  businessId: string | null;
  orderId: string | null;
  spotAssignmentId: string | null;
  metadata: Record<string, unknown>;
};

export type AiSessionView = {
  id: string;
  status: string;
  currentStep: string;
  selectedCityIds: string[];
  selectedCategoryIds: string[];
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  websiteUrl: string;
  facebookUrl: string;
  logoUrl: string;
  logoFileName: string;
  offerHeadline: string;
  aiGenerateOffer: boolean;
  militaryDiscountEligible: boolean;
  subtotalCents: number;
  discountCents: number;
  totalMonthlyCents: number;
  termMonths: number;
  totalContractValueCents: number;
  checkoutUrl: string | null;
};

export type AiMessageView = {
  id: string;
  role: "user" | "assistant" | "system";
  message: string;
  stepKey: string | null;
  createdAt: string;
};

export type AiIntakeState = {
  session: AiSessionView;
  messages: AiMessageView[];
  cartItems: AiCartItemView[];
};

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function placementLabel(placement: AiPlacementType): string {
  if (placement === "front") return "Front spot";
  if (placement === "back") return "Back spot";
  if (placement === "multiple") return "Multiple spots";
  return "Full-card exclusivity";
}

export function placementToSpotType(placement: AiPlacementType): string {
  if (placement === "front") return "front_feature";
  if (placement === "full_card_exclusivity") return "full_card";
  return "back_feature";
}

export function placementToBundleSlug(placement: AiPlacementType): string {
  if (placement === "front") return "front-feature";
  if (placement === "full_card_exclusivity") return "anchor";
  return "back-feature";
}

function centsFromPrice(value: unknown, fallbackCents = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallbackCents;
  return Number.isInteger(n) && n >= 1000 ? n : Math.round(n * 100);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeSession(row: any): AiSessionView {
  return {
    id: row.id,
    status: row.status ?? "draft",
    currentStep: row.current_step ?? "cities",
    selectedCityIds: asStringArray(row.selected_city_ids),
    selectedCategoryIds: asStringArray(row.selected_category_ids),
    businessName: row.business_name ?? "",
    contactName: row.contact_name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    websiteUrl: row.website_url ?? "",
    facebookUrl: row.facebook_url ?? "",
    logoUrl: row.logo_url ?? "",
    logoFileName: row.logo_file_name ?? "",
    offerHeadline: row.offer_headline ?? "",
    aiGenerateOffer: Boolean(row.ai_generate_offer),
    militaryDiscountEligible: Boolean(row.military_discount_eligible),
    subtotalCents: Number(row.subtotal_cents ?? 0),
    discountCents: Number(row.discount_cents ?? 0),
    totalMonthlyCents: Number(row.total_monthly_cents ?? 0),
    termMonths: Number(row.term_months ?? AI_INTAKE_TERM_MONTHS),
    totalContractValueCents: Number(row.total_contract_value_cents ?? 0),
    checkoutUrl: row.checkout_url ?? null,
  };
}

function normalizeCartItem(row: any): AiCartItemView {
  return {
    id: row.id,
    sessionId: row.session_id,
    cityId: row.city_id,
    categoryId: row.category_id,
    placementType: row.placement_type,
    quantity: Number(row.quantity ?? 1),
    pricingTier: row.pricing_tier ?? "standard",
    discountCode: row.discount_code ?? null,
    monthlyPriceCents: Number(row.monthly_price_cents ?? 0),
    termMonths: Number(row.term_months ?? AI_INTAKE_TERM_MONTHS),
    subtotalCents: Number(row.subtotal_cents ?? 0),
    availabilityStatus: row.availability_status ?? "available",
    availabilitySource: row.availability_source ?? null,
    availabilityMessage: row.availability_message ?? null,
    cityName: row.city_name_snapshot,
    categoryName: row.category_name_snapshot,
    placementLabel: row.placement_label,
    bundleId: row.bundle_id ?? null,
    businessId: row.business_id ?? null,
    orderId: row.order_id ?? null,
    spotAssignmentId: row.spot_assignment_id ?? null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

function normalizeMessage(row: any): AiMessageView {
  return {
    id: row.id,
    role: row.role,
    message: row.message,
    stepKey: row.step_key ?? null,
    createdAt: row.created_at,
  };
}

async function selectActiveCities(supa: ServiceClient): Promise<CityRow[]> {
  const withFounding = await supa
    .from("cities")
    .select("id, name, state, slug, is_active, founding_eligible")
    .eq("is_active", true)
    .order("name");

  if (!withFounding.error) return (withFounding.data ?? []) as CityRow[];

  const fallback = await supa
    .from("cities")
    .select("id, name, state, slug, is_active")
    .eq("is_active", true)
    .order("name");

  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []) as CityRow[];
}

async function selectActiveCategories(supa: ServiceClient): Promise<CategoryRow[]> {
  const { data, error } = await supa
    .from("categories")
    .select("id, name, slug, description, is_active")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

async function selectBundles(supa: ServiceClient): Promise<BundleRow[]> {
  const withPriceColumns = await supa
    .from("bundles")
    .select("id, name, slug, price, is_active, metadata, standard_price, founding_price")
    .eq("is_active", true);

  if (!withPriceColumns.error) return (withPriceColumns.data ?? []) as BundleRow[];

  const fallback = await supa
    .from("bundles")
    .select("id, name, slug, price, is_active, metadata")
    .eq("is_active", true);

  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []) as BundleRow[];
}

export async function loadAiIntakeOptions(supa: ServiceClient) {
  const [cityRows, categoryRows, bundles] = await Promise.all([
    selectActiveCities(supa),
    selectActiveCategories(supa),
    selectBundles(supa),
  ]);

  const snapshots = await Promise.all(
    cityRows.map(async (city) => {
      try {
        return await getSharedPostcardCitySnapshot(city.id);
      } catch {
        return null;
      }
    }),
  );

  const cities: AiIntakeCityOption[] = cityRows.map((city, index) => ({
    id: city.id,
    name: city.name,
    state: city.state,
    slug: city.slug,
    foundingEligible: Boolean(city.founding_eligible),
    availableSpots: snapshots[index]?.availableSpots ?? 0,
  }));

  const categories: AiIntakeCategoryOption[] = categoryRows.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
  }));

  return { cities, categories, bundles };
}

export async function appendAiIntakeMessage(args: {
  supa: ServiceClient;
  sessionId: string;
  role: "user" | "assistant" | "system";
  message: string;
  stepKey?: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await args.supa.from("ai_intake_messages").insert({
    session_id: args.sessionId,
    role: args.role,
    message: args.message,
    step_key: args.stepKey ?? null,
    structured_payload: args.payload ?? {},
  });

  if (error) throw error;
}

export async function createAiIntakeSession(supa: ServiceClient): Promise<string> {
  const { data, error } = await supa
    .from("ai_intake_sessions")
    .insert({
      status: "collecting",
      current_step: "cities",
      term_months: AI_INTAKE_TERM_MONTHS,
      metadata: {
        product: "shared_postcards",
        feature_flag: "ENABLE_AI_INTAKE_AGENT",
      },
    })
    .select("id")
    .single();

  if (error || !data) throw error ?? new Error("Could not create AI intake session");

  await appendAiIntakeMessage({
    supa,
    sessionId: data.id,
    role: "assistant",
    stepKey: "cities",
    message:
      "Hi, I can help you build a shared-postcard order across multiple cities and categories. Start by picking the city or cities you want to target.",
  });

  return data.id;
}

export async function loadAiIntakeState(
  supa: ServiceClient,
  sessionId: string,
): Promise<AiIntakeState> {
  const [sessionResult, messagesResult, cartResult] = await Promise.all([
    supa.from("ai_intake_sessions").select("*").eq("id", sessionId).single(),
    supa
      .from("ai_intake_messages")
      .select("id, role, message, step_key, created_at")
      .eq("session_id", sessionId)
      .order("created_at"),
    supa
      .from("ai_intake_cart_items")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at"),
  ]);

  if (sessionResult.error || !sessionResult.data) {
    throw sessionResult.error ?? new Error("AI intake session not found");
  }
  if (messagesResult.error) throw messagesResult.error;
  if (cartResult.error) throw cartResult.error;

  return {
    session: normalizeSession(sessionResult.data),
    messages: (messagesResult.data ?? []).map(normalizeMessage),
    cartItems: (cartResult.data ?? []).map(normalizeCartItem),
  };
}

export async function syncAiIntakeTotals(supa: ServiceClient, sessionId: string) {
  const { data, error } = await supa
    .from("ai_intake_cart_items")
    .select("subtotal_cents, metadata")
    .eq("session_id", sessionId)
    .neq("availability_status", "unavailable");

  if (error) throw error;

  let subtotal = 0;
  let discount = 0;
  for (const item of data ?? []) {
    subtotal += Number((item as any).subtotal_cents ?? 0);
    const itemDiscount = Number(((item as any).metadata ?? {}).discount_cents ?? 0);
    if (Number.isFinite(itemDiscount)) discount += itemDiscount;
  }

  const { error: updateError } = await supa
    .from("ai_intake_sessions")
    .update({
      subtotal_cents: subtotal + discount,
      discount_cents: discount,
      total_monthly_cents: subtotal,
      term_months: AI_INTAKE_TERM_MONTHS,
      total_contract_value_cents: subtotal * AI_INTAKE_TERM_MONTHS,
    })
    .eq("id", sessionId);

  if (updateError) throw updateError;
}

function findBundleForPlacement(bundles: BundleRow[], placement: AiPlacementType): BundleRow | null {
  const slug = placementToBundleSlug(placement);
  const bySlug = bundles.find((bundle) => bundle.slug === slug);
  if (bySlug) return bySlug;

  const desiredSpot = placement === "front" ? "front" : "back";
  return (
    bundles.find((bundle) => {
      const meta = bundle.metadata ?? {};
      return meta.spotType === desiredSpot;
    }) ?? bundles[0] ?? null
  );
}

async function buildSuggestions(args: {
  supa: ServiceClient;
  cityId: string;
  categoryId: string;
}) {
  const { cities, categories } = await loadAiIntakeOptions(args.supa);
  const nearbyCities: string[] = [];
  for (const city of cities) {
    if (city.id === args.cityId || nearbyCities.length >= 3) continue;
    const check = await checkCanonicalAvailability({
      cityId: city.id,
      categoryId: args.categoryId,
      supa: args.supa,
    });
    if (check.available) nearbyCities.push(`${city.name}, ${city.state}`);
  }

  const alternativeCategories: string[] = [];
  for (const category of categories) {
    if (category.id === args.categoryId || alternativeCategories.length >= 3) continue;
    const check = await checkCanonicalAvailability({
      cityId: args.cityId,
      categoryId: category.id,
      supa: args.supa,
    });
    if (check.available) alternativeCategories.push(category.name);
  }

  return { nearbyCities, alternativeCategories };
}

export async function addAiCartItems(args: {
  supa: ServiceClient;
  sessionId: string;
  cityIds: string[];
  categoryIds: string[];
  placementType: AiPlacementType;
  quantity: number;
  militaryEligible: boolean;
}) {
  const { cities, categories, bundles } = await loadAiIntakeOptions(args.supa);
  const cityMap = new Map(cities.map((city) => [city.id, city]));
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const bundle = findBundleForPlacement(bundles, args.placementType);

  if (!bundle) {
    throw new Error("No active shared-postcard bundle is available.");
  }

  const results: Array<{
    ok: boolean;
    cityName: string;
    categoryName: string;
    message: string;
    suggestions?: { nearbyCities: string[]; alternativeCategories: string[] };
  }> = [];

  for (const cityId of args.cityIds) {
    const city = cityMap.get(cityId);
    if (!city) continue;

    for (const categoryId of args.categoryIds) {
      const category = categoryMap.get(categoryId);
      if (!category) continue;

      const availability = await checkCanonicalAvailability({
        cityId,
        categoryId,
        supa: args.supa,
      });

      const snapshot = await getSharedPostcardCitySnapshot(cityId);
      let desiredQuantity =
        args.placementType === "full_card_exclusivity"
          ? Math.max(1, snapshot.availableSpots)
          : Math.max(1, args.quantity);

      const { data: existingItem, error: existingError } = await args.supa
        .from("ai_intake_cart_items")
        .select("id, quantity")
        .eq("session_id", args.sessionId)
        .eq("city_id", city.id)
        .eq("category_id", category.id)
        .in("availability_status", ["available", "reserved", "needs_admin_override"])
        .maybeSingle();
      if (existingError) throw existingError;

      if (existingItem && args.placementType !== "full_card_exclusivity") {
        desiredQuantity += Number((existingItem as any).quantity ?? 0);
      }

      const { data: cityCartItems, error: cityCartError } = await args.supa
        .from("ai_intake_cart_items")
        .select("id, quantity")
        .eq("session_id", args.sessionId)
        .eq("city_id", city.id)
        .in("availability_status", ["available", "reserved", "needs_admin_override"]);
      if (cityCartError) throw cityCartError;

      const otherQuantity = (cityCartItems ?? []).reduce((sum, item: any) => {
        if (existingItem && item.id === (existingItem as any).id) return sum;
        return sum + Number(item.quantity ?? 0);
      }, 0);

      if (!availability.available || desiredQuantity + otherQuantity > snapshot.availableSpots) {
        const suggestions = await buildSuggestions({ supa: args.supa, cityId, categoryId });
        results.push({
          ok: false,
          cityName: city.name,
          categoryName: category.name,
          message:
            availability.message ??
            `Only ${snapshot.availableSpots} spots are available in ${city.name}. Your cart would reserve ${desiredQuantity + otherQuantity}.`,
          suggestions,
        });
        continue;
      }

      const standardCents = centsFromPrice(bundle.standard_price, centsFromPrice(bundle.price, 0));
      const foundingCents = centsFromPrice(bundle.founding_price, standardCents);
      const pricingTier = city.foundingEligible && foundingCents > 0 ? "founding_member" : "standard";
      const unitCents = pricingTier === "founding_member" ? foundingCents : standardCents;
      const grossCents = unitCents * desiredQuantity;
      const discountCents = args.militaryEligible
        ? Math.round(grossCents * AI_INTAKE_MILITARY_DISCOUNT_RATE)
        : 0;
      const subtotalCents = Math.max(0, grossCents - discountCents);

      const itemPayload = {
        placement_type: args.placementType,
        quantity: desiredQuantity,
        pricing_tier: pricingTier,
        discount_code: args.militaryEligible ? "military_10" : null,
        monthly_price_cents: unitCents,
        term_months: AI_INTAKE_TERM_MONTHS,
        subtotal_cents: subtotalCents,
        availability_status: "available",
        availability_source: availability.source,
        availability_message: "Available at cart creation. Rechecked before checkout.",
        city_name_snapshot: `${city.name}, ${city.state}`,
        category_name_snapshot: category.name,
        placement_label: placementLabel(args.placementType),
        bundle_id: bundle.id,
        metadata: {
          gross_monthly_cents: grossCents,
          discount_cents: discountCents,
          unit_monthly_cents: unitCents,
          available_spots_at_quote: snapshot.availableSpots,
          postcard_size: "9 x 12",
          spot_size: "4 x 3.5",
          core_rule: "one active or pending reservation per city/category",
        },
      };

      const { error } = existingItem
        ? await args.supa
            .from("ai_intake_cart_items")
            .update(itemPayload)
            .eq("id", (existingItem as any).id)
        : await args.supa.from("ai_intake_cart_items").insert({
            session_id: args.sessionId,
            city_id: city.id,
            category_id: category.id,
            ...itemPayload,
          });

      if (error) throw error;

      results.push({
        ok: true,
        cityName: city.name,
        categoryName: category.name,
        message: existingItem
          ? `${category.name} in ${city.name} updated to ${desiredQuantity} spot(s).`
          : `${placementLabel(args.placementType)} added for ${category.name} in ${city.name}.`,
      });
    }
  }

  await args.supa
    .from("ai_intake_sessions")
    .update({
      status: "collecting",
      current_step: "details",
      selected_city_ids: args.cityIds,
      selected_category_ids: args.categoryIds,
      military_discount_requested: args.militaryEligible,
      military_discount_eligible: args.militaryEligible,
    })
    .eq("id", args.sessionId);

  await syncAiIntakeTotals(args.supa, args.sessionId);

  return results;
}

export function missingRequiredDetails(session: AiSessionView): string[] {
  const missing: string[] = [];
  if (!session.businessName.trim()) missing.push("business name");
  if (!session.contactName.trim()) missing.push("contact name");
  if (!session.phone.trim()) missing.push("phone");
  if (!session.email.trim()) missing.push("email");
  if (!session.websiteUrl.trim() && !session.facebookUrl.trim()) {
    missing.push("website or Facebook page");
  }
  if (!session.offerHeadline.trim() && !session.aiGenerateOffer) {
    missing.push("offer/headline or AI-generate approval");
  }
  return missing;
}

export async function validateCartAvailability(supa: ServiceClient, cartItems: AiCartItemView[]) {
  const quantityByCity = new Map<string, { quantity: number; cityName: string }>();

  for (const item of cartItems) {
    const availability = await checkCanonicalAvailability({
      cityId: item.cityId,
      categoryId: item.categoryId,
      supa,
    });
    if (!availability.available) {
      return {
        ok: false as const,
        item,
        message:
          availability.message ??
          `${item.categoryName} in ${item.cityName} is no longer available.`,
      };
    }

    const snapshot = await getSharedPostcardCitySnapshot(item.cityId);
    if (item.quantity > snapshot.availableSpots) {
      return {
        ok: false as const,
        item,
        message: `${item.cityName} only has ${snapshot.availableSpots} open spots right now.`,
      };
    }

    const existing = quantityByCity.get(item.cityId) ?? { quantity: 0, cityName: item.cityName };
    quantityByCity.set(item.cityId, {
      cityName: item.cityName,
      quantity: existing.quantity + item.quantity,
    });
  }

  for (const [cityId, city] of quantityByCity.entries()) {
    const snapshot = await getSharedPostcardCitySnapshot(cityId);
    if (city.quantity > snapshot.availableSpots) {
      return {
        ok: false as const,
        item: null,
        message: `${city.cityName} only has ${snapshot.availableSpots} open spots. Your cart has ${city.quantity}.`,
      };
    }
  }

  return { ok: true as const };
}
