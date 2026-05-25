import { describe, expect, it } from "vitest";
import {
  buildPropertyIntelligenceCheckoutMetadata,
  normalizeIntelligenceCheckoutBody,
  pickFoundingSlot,
  PROPERTY_INTELLIGENCE_CHECKOUT_TYPE,
  stripeResourceId,
  toPositiveCents,
} from "../checkout";

describe("property intelligence checkout helpers", () => {
  it("normalizes public checkout payloads", () => {
    const result = normalizeIntelligenceCheckoutBody({
      tier: " T2 ",
      city: " Austin ",
      category: "",
      market_size: " 50000 ",
      businessName: " Example Roofing ",
      email: " OWNER@Example.COM ",
      phone: " 555-0100 ",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        tier: "t2",
        city: "Austin",
        category: "all",
        marketSize: "50000",
        businessName: "Example Roofing",
        email: "owner@example.com",
        phone: "555-0100",
      },
    });
  });

  it("rejects missing required fields", () => {
    expect(normalizeIntelligenceCheckoutBody({ tier: "t1" })).toEqual({
      ok: false,
      error: "Missing required fields: tier, city, businessName, email, phone",
    });
  });

  it("prefers exact category founding slots before citywide fallback slots", () => {
    const slot = pickFoundingSlot(
      [
        { id: "fallback", category: null, founding_open: true, slots_remaining: 5 },
        { id: "roofing", category: "Roofing", founding_open: true, slots_remaining: 1 },
      ],
      "Roofing",
    );

    expect(slot?.id).toBe("roofing");
  });

  it("ignores closed or depleted founding slots", () => {
    const slot = pickFoundingSlot(
      [
        { id: "closed", category: "Roofing", founding_open: false, slots_remaining: 5 },
        { id: "empty", category: null, founding_open: true, slots_remaining: 0 },
      ],
      "Roofing",
    );

    expect(slot).toBeNull();
  });

  it("builds Stripe metadata with explicit lifecycle type", () => {
    const checkout = normalizeIntelligenceCheckoutBody({
      tier: "t1",
      city: "Austin",
      category: "Roofing",
      businessName: "Example Roofing",
      email: "owner@example.com",
      phone: "555-0100",
    });

    expect(checkout.ok).toBe(true);
    if (!checkout.ok) return;

    expect(
      buildPropertyIntelligenceCheckoutMetadata({
        checkout: checkout.value,
        product: "intelligence_t1",
        isFounding: true,
        lockedPriceCents: 6900,
        standardPriceCents: 9900,
        slotId: "slot-1",
        slotCategory: "Roofing",
      }),
    ).toMatchObject({
      type: PROPERTY_INTELLIGENCE_CHECKOUT_TYPE,
      founding_flag: "true",
      locked_price: "6900",
      standard_price: "9900",
      slot_id: "slot-1",
      slot_category: "Roofing",
    });
  });

  it("normalizes Stripe resource ids and cent values", () => {
    expect(stripeResourceId("sub_123")).toBe("sub_123");
    expect(stripeResourceId({ id: "sub_456" })).toBe("sub_456");
    expect(stripeResourceId({})).toBeNull();
    expect(toPositiveCents("1234.4")).toBe(1234);
    expect(toPositiveCents("-1")).toBeNull();
  });
});
