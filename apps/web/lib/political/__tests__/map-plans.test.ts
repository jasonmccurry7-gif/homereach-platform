import { afterEach, describe, expect, it } from "vitest";
import { savePublicMapPlan } from "../map-plans";

describe("public political map plan persistence", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }

    if (originalServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    }
  });

  it("does not create a database-backed plan for an empty public selection", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";

    const result = await savePublicMapPlan({});

    expect(result).toEqual({
      ok: false,
      stored: "local_only",
      reason: "No map routes or political geographies were selected.",
    });
  });

  it("keeps meaningful selections eligible for persistence after the selection gate", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await savePublicMapPlan({
      selectedRoutes: [
        {
          id: "route-1",
          label: "Route 1",
          zip5: "44101",
          carrierRouteId: "C001",
          deliveryPoints: 300,
          households: 280,
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      stored: "local_only",
      reason: "Supabase service credentials are not configured in this environment.",
    });
  });
});
