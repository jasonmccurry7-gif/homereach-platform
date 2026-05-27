import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const mocks = vi.hoisted(() => ({
  constructWebhookEvent: vi.fn(),
  createServiceClient: vi.fn(),
  notifyAdminCampaignPaid: vi.fn(),
  sendEmail: vi.fn(),
  sendPaymentConfirmation: vi.fn(),
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}));

type TableMock = Record<string, string> & { __name: string };
type DbCall = { table: string; payload?: unknown };
type InsertBuilder = {
  values: ReturnType<typeof vi.fn>;
  onConflictDoNothing: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  then: Promise<unknown[]>["then"];
};
type UpdateBuilder = {
  set: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  then: Promise<unknown[]>["then"];
};
type SelectBuilder = {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  then: Promise<unknown[]>["then"];
};
type DbMockOptions = {
  insertResults?: Record<string, unknown[]>;
  selectResults?: Record<string, unknown[][]>;
  updateResults?: Record<string, unknown[]>;
};

function table(name: string, columns: string[]): TableMock {
  return Object.fromEntries([
    ["__name", name],
    ...columns.map((column) => [column, `${name}.${column}`]),
  ]) as TableMock;
}

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ type: "and", conditions }),
  eq: (left: unknown, right: unknown) => ({ type: "eq", left, right }),
}));

vi.mock("@homereach/services/stripe", () => ({
  constructWebhookEvent: mocks.constructWebhookEvent,
}));

vi.mock("@homereach/services/auth", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@homereach/services/outreach", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("@homereach/services/targeted", () => ({
  notifyAdminCampaignPaid: mocks.notifyAdminCampaignPaid,
  sendPaymentConfirmation: mocks.sendPaymentConfirmation,
}));

vi.mock("@/lib/intelligence/checkout", () => ({
  PROPERTY_INTELLIGENCE_CHECKOUT_TYPE: "property_intelligence_checkout",
  stripeResourceId: (resource: string | { id?: string } | null | undefined) => {
    if (!resource) return null;
    return typeof resource === "string" ? resource : resource.id ?? null;
  },
  toPositiveCents: (value: unknown) => {
    const cents = Number(value);
    return Number.isFinite(cents) && cents > 0 ? cents : null;
  },
}));

vi.mock("@/lib/intelligence/schema-readiness", () => ({
  checkPropertyIntelligenceFoundingSchemaReady: vi.fn(),
}));

vi.mock("@/lib/runtime/app-url", () => ({
  getPublicAppBaseUrl: () => "https://home-reach.test",
}));

vi.mock("@/lib/stripe/subscription-activation", () => ({
  isCheckoutSessionPaymentSatisfied: (
    paymentStatus: string | null | undefined,
  ) => paymentStatus === "paid" || paymentStatus === "no_payment_required",
  isStripeSubscriptionProvisionableStatus: (
    status: string | null | undefined,
  ) => status === "active" || status === "trialing",
  mapStripeSubscriptionStatusToSpotStatus: (
    status: string | null | undefined,
  ) => (
    status === "active" || status === "trialing"
      ? "active"
      : status === "past_due" || status === "unpaid" || status === "paused"
        ? "paused"
        : null
  ),
}));

vi.mock("@/lib/stripe/webhook-idempotency", () => ({
  decideStripeEventClaimForExisting: () => "process",
}));

vi.mock("@homereach/db", () => ({
  db: mocks.db,
  businesses: table("businesses", [
    "categoryId",
    "cityId",
    "email",
    "id",
    "name",
    "status",
    "stripeCustomerId",
    "supabaseUserId",
    "updatedAt",
  ]),
  intakeSubmissions: table("intake_submissions", [
    "accessToken",
    "businessId",
    "spotAssignmentId",
    "status",
  ]),
  leads: table("leads", ["id", "paidAt", "status", "updatedAt"]),
  marketingCampaigns: table("marketing_campaigns", ["id"]),
  orders: table("orders", [
    "businessId",
    "bundleId",
    "id",
    "paidAt",
    "pricingSnapshotJson",
    "status",
    "stripeCustomerId",
    "stripePaymentIntentId",
    "stripeSubscriptionId",
    "updatedAt",
  ]),
  spotAssignments: table("spot_assignments", [
    "activatedAt",
    "businessId",
    "categoryId",
    "cityId",
    "commitmentEndsAt",
    "id",
    "status",
    "stripeCustomerId",
    "stripeSubscriptionId",
    "updatedAt",
  ]),
  stripeWebhookEvents: table("stripe_webhook_events", [
    "error",
    "eventType",
    "id",
    "payload",
    "processedAt",
    "receivedAt",
    "status",
  ]),
  targetedRouteCampaigns: table("targeted_route_campaigns", [
    "businessName",
    "contactName",
    "designStatus",
    "email",
    "homesCount",
    "id",
    "leadId",
    "priceCents",
    "status",
    "stripePaymentIntentId",
    "targetCity",
    "updatedAt",
  ]),
}));

function createDbMock(options: DbMockOptions = {}) {
  const calls = {
    inserts: [] as DbCall[],
    updates: [] as DbCall[],
    selects: [] as DbCall[],
  };

  function takeRows(
    rowsByTable: Record<string, unknown[][]> | undefined,
    tableName: string,
    fallback: unknown[] = [],
  ) {
    const queue = rowsByTable?.[tableName];
    if (!queue || queue.length === 0) return fallback;
    return queue.shift() ?? fallback;
  }

  mocks.db.insert.mockImplementation((tableArg: TableMock) => {
    const rows = options.insertResults?.[tableArg.__name]
      ?? (tableArg.__name === "stripe_webhook_events" ? [{ id: "evt_test" }] : []);
    const builder = {
      values: vi.fn((payload: unknown) => {
        calls.inserts.push({ table: tableArg.__name, payload });
        return builder;
      }),
      onConflictDoNothing: vi.fn(() => builder),
      returning: vi.fn(() => builder),
      then: (resolve: (value: unknown[]) => void, reject: (reason?: unknown) => void) =>
        Promise.resolve(rows).then(resolve, reject),
    } satisfies InsertBuilder;

    return builder;
  });

  mocks.db.update.mockImplementation((tableArg: TableMock) => {
    const rows = options.updateResults?.[tableArg.__name] ?? [];
    const builder = {
      set: vi.fn((payload: unknown) => {
        calls.updates.push({ table: tableArg.__name, payload });
        return builder;
      }),
      where: vi.fn(() => builder),
      returning: vi.fn(() => builder),
      then: (resolve: (value: unknown[]) => void, reject: (reason?: unknown) => void) =>
        Promise.resolve(rows).then(resolve, reject),
    } satisfies UpdateBuilder;

    return builder;
  });

  mocks.db.select.mockImplementation(() => {
    let tableName = "";
    const builder = {
      from: vi.fn((tableArg: TableMock) => {
        tableName = tableArg.__name;
        calls.selects.push({ table: tableArg.__name });
        return builder;
      }),
      where: vi.fn(() => builder),
      limit: vi.fn(async () => takeRows(options.selectResults, tableName)),
      then: (resolve: (value: unknown[]) => void, reject: (reason?: unknown) => void) =>
        Promise.resolve(takeRows(options.selectResults, tableName)).then(resolve, reject),
    } satisfies SelectBuilder;

    return builder;
  });

  return calls;
}

function stripeWebhookRequest() {
  return new Request("https://home-reach.test/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "test-signature" },
    body: "{}",
  });
}

describe("Stripe webhook route payment activation gates", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.sendEmail.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("does not activate inventory, business, intake, or email for incomplete subscription.created", async () => {
    const calls = createDbMock();
    mocks.constructWebhookEvent.mockReturnValue({
      id: "evt_incomplete_sub",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_incomplete",
          status: "incomplete",
          customer: "cus_test",
          metadata: {
            businessId: "business-1",
            orderId: "order-1",
          },
        },
      },
    });

    const response = await POST(stripeWebhookRequest());

    expect(response.status).toBe(200);
    expect(calls.updates.filter((call) => call.table !== "stripe_webhook_events")).toEqual([]);
    expect(calls.inserts.map((call) => call.table)).toEqual(["stripe_webhook_events"]);
    expect(calls.selects).toEqual([]);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("does not mark generic checkout sessions paid when payment is not satisfied", async () => {
    const calls = createDbMock();
    mocks.constructWebhookEvent.mockReturnValue({
      id: "evt_unpaid_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_unpaid",
          payment_status: "unpaid",
          metadata: {
            orderId: "order-1",
          },
        },
      },
    });

    const response = await POST(stripeWebhookRequest());

    expect(response.status).toBe(200);
    expect(calls.updates.filter((call) => call.table !== "stripe_webhook_events")).toEqual([]);
    expect(calls.inserts.map((call) => call.table)).toEqual(["stripe_webhook_events"]);
    expect(calls.selects).toEqual([]);
  });

  it("does not queue targeted campaign work when checkout payment is not satisfied", async () => {
    const calls = createDbMock();
    mocks.constructWebhookEvent.mockReturnValue({
      id: "evt_unpaid_targeted_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_targeted_unpaid",
          payment_status: "unpaid",
          metadata: {
            campaignId: "campaign-1",
            type: "targeted_route_campaign",
          },
        },
      },
    });

    const response = await POST(stripeWebhookRequest());

    expect(response.status).toBe(200);
    expect(calls.updates.filter((call) => call.table !== "stripe_webhook_events")).toEqual([]);
    expect(calls.inserts.map((call) => call.table)).toEqual(["stripe_webhook_events"]);
    expect(calls.selects).toEqual([]);
    expect(mocks.sendPaymentConfirmation).not.toHaveBeenCalled();
    expect(mocks.notifyAdminCampaignPaid).not.toHaveBeenCalled();
  });

  it("activates through orderId fallback when subscription.updated becomes active", async () => {
    const inviteUserByEmail = vi.fn(async () => ({
      data: { user: { id: "user-1" } },
      error: null,
    }));
    const calls = createDbMock({
      insertResults: {
        intake_submissions: [{ accessToken: "intake-token-1" }],
      },
      selectResults: {
        spot_assignments: [
          [],
          [{ id: "spot-1" }],
        ],
        orders: [[{ id: "order-1", businessId: "business-1" }]],
        businesses: [
          [{ id: "business-1", cityId: "city-1", categoryId: "category-1" }],
          [{ email: "owner@example.test", name: "Example Roofing", stripeCustomerId: null }],
        ],
      },
    });
    mocks.createServiceClient.mockReturnValue({
      auth: { admin: { inviteUserByEmail } },
    });
    mocks.constructWebhookEvent.mockReturnValue({
      id: "evt_active_sub_update",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_active",
          status: "active",
          customer: "cus_test",
          metadata: {
            businessId: "business-1",
            orderId: "order-1",
          },
        },
      },
    });

    const response = await POST(stripeWebhookRequest());

    expect(response.status).toBe(200);
    expect(calls.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: "spot_assignments",
        payload: expect.objectContaining({
          status: "active",
          stripeSubscriptionId: "sub_active",
          stripeCustomerId: "cus_test",
        }),
      }),
      expect.objectContaining({
        table: "businesses",
        payload: expect.objectContaining({
          status: "active",
          stripeCustomerId: "cus_test",
        }),
      }),
      expect.objectContaining({
        table: "businesses",
        payload: expect.objectContaining({
          supabaseUserId: "user-1",
        }),
      }),
    ]));
    expect(calls.inserts).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "stripe_webhook_events" }),
      expect.objectContaining({
        table: "intake_submissions",
        payload: expect.objectContaining({
          businessId: "business-1",
          spotAssignmentId: "spot-1",
          status: "pending",
        }),
      }),
    ]));
    expect(inviteUserByEmail).toHaveBeenCalledWith(
      "owner@example.test",
      { redirectTo: "https://home-reach.test/intake/intake-token-1" },
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "owner@example.test",
      html: expect.stringContaining("https://home-reach.test/intake/intake-token-1"),
    }));
  });
});
