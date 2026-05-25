import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getStripe: vi.fn(),
  checkSchemaReady: vi.fn(),
  pickFoundingSlot: vi.fn(),
  readIntelligenceCheckoutPayload: vi.fn(),
  toPositiveCents: vi.fn((value: unknown) => Number(value)),
  buildPropertyIntelligenceCheckoutMetadata: vi.fn(() => ({
    type: "property_intelligence_checkout",
    founding_flag: "true",
  })),
  schemaUnavailable: "Property intelligence founding checkout is temporarily unavailable",
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/lib/runtime/app-url", () => ({
  getPublicAppBaseUrl: () => "https://home-reach.test",
}));

vi.mock("@homereach/services/stripe", () => ({
  getStripe: mocks.getStripe,
}));

vi.mock("@/lib/intelligence/checkout", () => ({
  buildPropertyIntelligenceCheckoutMetadata: mocks.buildPropertyIntelligenceCheckoutMetadata,
  pickFoundingSlot: mocks.pickFoundingSlot,
  readIntelligenceCheckoutPayload: mocks.readIntelligenceCheckoutPayload,
  toPositiveCents: mocks.toPositiveCents,
}));

vi.mock("@/lib/intelligence/schema-readiness", () => ({
  checkPropertyIntelligenceFoundingSchemaReady: mocks.checkSchemaReady,
  PROPERTY_INTELLIGENCE_FOUNDING_SCHEMA_UNAVAILABLE: mocks.schemaUnavailable,
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

type QueryResult = {
  data?: unknown;
  error: { code?: string; message?: string } | null;
};

type QueryBuilder = PromiseLike<QueryResult> & {
  select: (columns: string, options?: unknown) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  single: () => Promise<QueryResult>;
  limit: (count: number) => Promise<QueryResult>;
};

function queryBuilder(result: QueryResult): QueryBuilder {
  const builder = {} as QueryBuilder;
  const promise = Promise.resolve(result);
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.single = vi.fn(async () => result);
  builder.limit = vi.fn(async () => result);
  builder.then = promise.then.bind(promise);
  return builder;
}

function checkoutDbMock(schemaProbeError: QueryResult["error"]) {
  const tier = queryBuilder({
    data: {
      standard_price_cents: 9900,
      founding_price_cents: 6900,
    },
    error: null,
  });
  const slots = queryBuilder({
    data: [
      {
        id: "slot-1",
        category: "Roofing",
        founding_open: true,
        slots_remaining: 1,
      },
    ],
    error: null,
  });
  const schema = queryBuilder({ error: schemaProbeError });

  return {
    from: vi.fn((table: string) => {
      if (table === "property_intelligence_tiers") return tier;
      if (table === "founding_slots") return slots;
      if (table === "founding_memberships") return schema;
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function checkoutRequest() {
  return new Request("https://home-reach.test/api/intelligence/checkout", {
    method: "POST",
    body: JSON.stringify({
      tier: "t1",
      city: "Austin",
      category: "Roofing",
      businessName: "Example Roofing",
      email: "owner@example.com",
      phone: "555-0100",
    }),
  });
}

describe("property intelligence checkout route", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.pickFoundingSlot.mockReturnValue({
      id: "slot-1",
      category: "Roofing",
      founding_open: true,
      slots_remaining: 1,
    });
    mocks.readIntelligenceCheckoutPayload.mockResolvedValue({
      ok: true,
      value: {
        tier: "t1",
        city: "Austin",
        category: "Roofing",
        marketSize: null,
        businessName: "Example Roofing",
        email: "owner@example.com",
        phone: "555-0100",
      },
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("fails closed before creating Stripe sessions when founding membership schema is missing", async () => {
    const db = checkoutDbMock({
      code: "PGRST204",
      message: "Could not find the 'stripe_checkout_session_id' column of 'founding_memberships' in the schema cache",
    });
    const createSession = vi.fn();
    mocks.createServiceClient.mockReturnValue(db);
    mocks.checkSchemaReady.mockResolvedValue({
      ok: false,
      reason: "missing_checkout_session_column",
      message: mocks.schemaUnavailable,
      diagnostics: "founding_memberships.stripe_checkout_session_id is missing",
    });
    mocks.getStripe.mockReturnValue({
      checkout: { sessions: { create: createSession } },
    });

    const response = await POST(checkoutRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: mocks.schemaUnavailable,
    });
    expect(mocks.checkSchemaReady).toHaveBeenCalledWith(db);
    expect(createSession).not.toHaveBeenCalled();
  });
});
