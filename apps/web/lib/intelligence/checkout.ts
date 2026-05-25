export const PROPERTY_INTELLIGENCE_CHECKOUT_TYPE = "property_intelligence";

export type IntelligenceCheckoutInput = {
  tier: string;
  city: string;
  category: string;
  marketSize: string;
  businessName: string;
  email: string;
  phone: string;
};

export type FoundingSlotCandidate = {
  id?: string | null;
  category?: string | null;
  slots_remaining?: number | string | null;
  founding_open?: boolean | null;
};

export type NormalizeIntelligenceCheckoutResult =
  | { ok: true; value: IntelligenceCheckoutInput }
  | { ok: false; error: string };

export async function readIntelligenceCheckoutPayload(
  req: Pick<Request, "json">,
): Promise<NormalizeIntelligenceCheckoutResult> {
  try {
    return normalizeIntelligenceCheckoutBody(await req.json());
  } catch {
    return { ok: false, error: "Invalid checkout payload" };
  }
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanCategory(value: unknown): string {
  const category = cleanString(value);
  return category || "all";
}

export function normalizeIntelligenceCheckoutBody(
  body: unknown,
): NormalizeIntelligenceCheckoutResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid checkout payload" };
  }

  const record = body as Record<string, unknown>;
  const value: IntelligenceCheckoutInput = {
    tier: cleanString(record.tier).toLowerCase(),
    city: cleanString(record.city),
    category: cleanCategory(record.category),
    marketSize: cleanString(record.market_size ?? record.marketSize),
    businessName: cleanString(record.businessName),
    email: cleanString(record.email).toLowerCase(),
    phone: cleanString(record.phone),
  };

  if (!value.tier || !value.city || !value.businessName || !value.email || !value.phone) {
    return {
      ok: false,
      error: "Missing required fields: tier, city, businessName, email, phone",
    };
  }

  if (!value.email.includes("@")) {
    return { ok: false, error: "A valid email address is required" };
  }

  return { ok: true, value };
}

function slotsRemaining(slot: FoundingSlotCandidate): number {
  const value = Number(slot.slots_remaining ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function categoryMatches(slotCategory: string | null | undefined, category: string): boolean {
  if (category === "all") {
    return slotCategory === null || slotCategory === undefined || slotCategory === "" || slotCategory === "all";
  }

  return slotCategory === category;
}

function isFallbackSlot(slotCategory: string | null | undefined): boolean {
  return slotCategory === null || slotCategory === undefined || slotCategory === "" || slotCategory === "all";
}

export function pickFoundingSlot<T extends FoundingSlotCandidate>(
  slots: T[] | null | undefined,
  category: string,
): T | null {
  const availableSlots = (slots ?? []).filter(
    (slot) => slot.founding_open !== false && slotsRemaining(slot) > 0,
  );

  return (
    availableSlots.find((slot) => categoryMatches(slot.category, category)) ??
    availableSlots.find((slot) => isFallbackSlot(slot.category)) ??
    null
  );
}

export function toPositiveCents(value: unknown): number | null {
  const cents = Number(value);
  if (!Number.isFinite(cents) || cents < 0) return null;
  return Math.round(cents);
}

export function stripeResourceId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export function buildPropertyIntelligenceCheckoutMetadata(input: {
  checkout: IntelligenceCheckoutInput;
  product: string;
  isFounding: boolean;
  lockedPriceCents: number;
  standardPriceCents: number;
  slotId?: string | null;
  slotCategory?: string | null;
}): Record<string, string> {
  return {
    type: PROPERTY_INTELLIGENCE_CHECKOUT_TYPE,
    city: input.checkout.city,
    category: input.checkout.category,
    market_size: input.checkout.marketSize,
    tier: input.checkout.tier,
    product: input.product,
    founding_flag: input.isFounding ? "true" : "false",
    locked_price: String(input.lockedPriceCents),
    standard_price: String(input.standardPriceCents),
    business_name: input.checkout.businessName,
    email: input.checkout.email,
    phone: input.checkout.phone,
    slot_id: input.slotId ?? "",
    slot_category: input.slotCategory ?? "",
  };
}
