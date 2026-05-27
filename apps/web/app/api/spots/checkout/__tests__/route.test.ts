import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  checkCanonicalAvailability: vi.fn(),
  createCustomer: vi.fn(),
  createCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/lib/spots/canonical-availability", () => ({
  checkCanonicalAvailability: mocks.checkCanonicalAvailability,
}));

vi.mock("@/lib/runtime/app-url", () => ({
  getPublicAppBaseUrl: () => "https://home-reach.test",
}));

vi.mock("@/lib/security/public-rate-limit", () => ({
  checkPublicRateLimit: () => ({
    allowed: true,
    limit: 12,
    remaining: 11,
    resetAt: Date.now() + 60_000,
  }),
  publicRateLimitHeaders: () => new Headers(),
}));

vi.mock("stripe", () => {
  const StripeMock = vi.fn(function StripeMock() {
    return {
      customers: {
        create: mocks.createCustomer,
      },
      checkout: {
        sessions: {
          create: mocks.createCheckoutSession,
        },
      },
    };
  });

  return { default: StripeMock };
});

type QueryResult = {
  data?: unknown;
  error: { message?: string } | null;
};

function selectBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.single = vi.fn(async () => result);
  builder.maybeSingle = vi.fn(async () => result);
  return builder;
}

function insertBuilder(
  table: string,
  id: string,
  inserts: Record<string, unknown[]>,
) {
  return (payload: unknown) => {
    inserts[table] = [...(inserts[table] ?? []), payload];
    return {
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: { id },
          error: null,
        })),
      })),
    };
  };
}

function checkoutDbMock() {
  const inserts: Record<string, unknown[]> = {};
  const updates: Record<string, unknown[]> = {};

  return {
    inserts,
    updates,
    from: vi.fn((table: string) => {
      if (table === "bundles") {
        return selectBuilder({
          data: {
            id: "bundle-1",
            name: "Anchor Spot",
            price: "600.00",
            standard_price: 90000,
            founding_price: 60000,
            pricing_profile_id: null,
            metadata: { spotType: "anchor", maxSpots: 1 },
          },
          error: null,
        });
      }

      if (table === "cities") {
        return selectBuilder({
          data: {
            id: "city-1",
            name: "Akron",
            state: "OH",
            founding_eligible: false,
          },
          error: null,
        });
      }

      if (table === "businesses") {
        return {
          select: vi.fn(() => selectBuilder({ data: null, error: null })),
          insert: insertBuilder("businesses", "business-1", inserts),
          update: vi.fn((payload: unknown) => ({
            eq: vi.fn(async () => {
              updates[table] = [...(updates[table] ?? []), payload];
              return { data: null, error: null };
            }),
          })),
        };
      }

      if (table === "orders") {
        return {
          insert: insertBuilder("orders", "order-1", inserts),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function checkoutRequest() {
  return new Request("https://home-reach.test/api/spots/checkout", {
    method: "POST",
    body: JSON.stringify({
      bundleId: "bundle-1",
      cityId: "city-1",
      categoryId: "category-1",
      citySlug: "akron-oh",
      categorySlug: "roofing",
      businessName: "Example Roofing",
      phone: "+15555550100",
      pricingType: "founding",
      lockedPrice: 1,
    }),
  });
}

describe("spots checkout pricing authority", () => {
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_route";
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: "user-1",
              email: "owner@example.test",
            },
          },
        }),
      },
    });
    mocks.checkCanonicalAvailability.mockResolvedValue({
      available: true,
      source: "available",
    });
    mocks.createCustomer.mockResolvedValue({ id: "cus_1" });
    mocks.createCheckoutSession.mockResolvedValue({
      url: "https://stripe.test/session",
    });
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
    if (originalStripeKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalStripeKey;
    }
  });

  it("ignores browser-supplied lockedPrice and charges the server-resolved bundle price", async () => {
    const db = checkoutDbMock();
    mocks.createServiceClient.mockReturnValue(db);

    const response = await POST(checkoutRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      checkoutUrl: "https://stripe.test/session",
      orderId: "order-1",
    });

    expect(db.inserts.orders).toHaveLength(1);
    expect(db.inserts.orders[0]).toMatchObject({
      subtotal: "900.00",
      total: "900.00",
      locked_price: 90000,
      pricing_type: "standard",
    });

    expect(mocks.createCheckoutSession).toHaveBeenCalledTimes(1);
    const [sessionParams] = mocks.createCheckoutSession.mock.calls[0];
    expect(sessionParams.line_items[0].price_data.unit_amount).toBe(90000);
    expect(sessionParams.metadata).toMatchObject({
      pricingType: "standard",
      lockedPrice: "90000",
      pricingSource: "bundle_price_columns",
    });
    expect(sessionParams.subscription_data.metadata).toMatchObject({
      pricingType: "standard",
      lockedPrice: "90000",
      pricingSource: "bundle_price_columns",
    });
  });
});
