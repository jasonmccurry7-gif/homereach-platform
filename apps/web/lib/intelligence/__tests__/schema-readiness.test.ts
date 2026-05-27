import { describe, expect, it } from "vitest";
import {
  checkPropertyIntelligenceFoundingSchemaReady,
  isMissingSupabaseColumnError,
  PROPERTY_INTELLIGENCE_FOUNDING_SCHEMA_UNAVAILABLE,
  type PropertyIntelligenceSchemaProbeClient,
} from "../schema-readiness";

function schemaProbe(error: { code?: string; message?: string } | null): PropertyIntelligenceSchemaProbeClient {
  return {
    from: () => ({
      select: () => ({
        limit: async () => ({ error }),
      }),
    }),
  };
}

describe("property intelligence schema readiness", () => {
  it("recognizes missing checkout-session column errors", () => {
    expect(isMissingSupabaseColumnError({
      code: "PGRST204",
      message: "Could not find the 'stripe_checkout_session_id' column of 'founding_memberships' in the schema cache",
    }, "stripe_checkout_session_id")).toBe(true);

    expect(isMissingSupabaseColumnError({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    }, "stripe_checkout_session_id")).toBe(false);
  });

  it("returns unavailable when the founding membership idempotency column is missing", async () => {
    await expect(checkPropertyIntelligenceFoundingSchemaReady(schemaProbe({
      code: "PGRST204",
      message: "Could not find the 'stripe_checkout_session_id' column of 'founding_memberships' in the schema cache",
    }))).resolves.toEqual({
      ok: false,
      reason: "missing_checkout_session_column",
      message: PROPERTY_INTELLIGENCE_FOUNDING_SCHEMA_UNAVAILABLE,
      diagnostics:
        "founding_memberships.stripe_checkout_session_id is missing; apply the additive property-intelligence schema migration before creating founding checkout sessions.",
    });
  });

  it("throws unexpected Supabase probe errors", async () => {
    const error = {
      code: "PGRST000",
      message: "database unavailable",
    };

    await expect(checkPropertyIntelligenceFoundingSchemaReady(schemaProbe(error))).rejects.toBe(error);
  });
});
