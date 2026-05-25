export const PROPERTY_INTELLIGENCE_FOUNDING_SCHEMA_UNAVAILABLE =
  "Property intelligence founding checkout is temporarily unavailable";

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type SchemaProbeResponse = {
  error: SupabaseErrorLike | null;
};

type SchemaProbeLimitBuilder = {
  limit(count: number): PromiseLike<SchemaProbeResponse>;
};

type SchemaProbeSelectBuilder = {
  select(columns: string, options: { head: true }): SchemaProbeLimitBuilder;
};

export type PropertyIntelligenceSchemaProbeClient = {
  from(table: "founding_memberships"): SchemaProbeSelectBuilder;
};

export type PropertyIntelligenceSchemaReadiness =
  | { ok: true }
  | {
      ok: false;
      reason: "missing_checkout_session_column";
      message: string;
      diagnostics: string;
    };

export function isMissingSupabaseColumnError(
  error: SupabaseErrorLike | null | undefined,
  column: string,
) {
  if (!error) {
    return false;
  }

  const code = error.code?.toUpperCase();
  const haystack = [
    error.code,
    error.message,
    error.details,
    error.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (code === "PGRST204" || code === "42703") && haystack.includes(column.toLowerCase());
}

export async function checkPropertyIntelligenceFoundingSchemaReady(
  supabase: PropertyIntelligenceSchemaProbeClient,
): Promise<PropertyIntelligenceSchemaReadiness> {
  const { error } = await supabase
    .from("founding_memberships")
    .select("stripe_checkout_session_id", { head: true })
    .limit(1);

  if (!error) {
    return { ok: true };
  }

  if (isMissingSupabaseColumnError(error, "stripe_checkout_session_id")) {
    return {
      ok: false,
      reason: "missing_checkout_session_column",
      message: PROPERTY_INTELLIGENCE_FOUNDING_SCHEMA_UNAVAILABLE,
      diagnostics:
        "founding_memberships.stripe_checkout_session_id is missing; apply the additive property-intelligence schema migration before creating founding checkout sessions.",
    };
  }

  throw error;
}
