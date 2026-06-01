import { NextResponse } from "next/server";
import { requireRole, roleOf } from "@/lib/auth/api-guards";
import {
  hasBusinessMemoryPersistence,
  isBusinessMemoryEnabled,
} from "@/lib/business-memory/config";
import {
  loadAdminBusinessMemory,
  loadBusinessMemoryProfile,
  loadClientBusinessMemory,
} from "@/lib/business-memory/memory";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isBusinessMemoryEnabled()) {
    return NextResponse.json({ error: "Business Memory is disabled." }, { status: 404 });
  }

  const guard = await requireRole(["admin", "sales_agent", "client"]);
  if (!guard.ok) return guard.response;

  if (!hasBusinessMemoryPersistence()) {
    return NextResponse.json(
      { error: "Business Memory persistence is not configured.", safeMode: true },
      { status: 503 },
    );
  }

  const user = guard.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = roleOf(user);
  const url = new URL(request.url);
  const requestedScope = url.searchParams.get("scope")?.trim().toLowerCase();
  const profileId = url.searchParams.get("profileId")?.trim();
  const search = url.searchParams.get("q")?.trim();
  const adminScope = requestedScope === "admin" || Boolean(profileId);

  if (adminScope && role === "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = createServiceClient();

    if (profileId && (role === "admin" || role === "sales_agent")) {
      const data = await loadBusinessMemoryProfile({ supabase, profileId, search });
      return NextResponse.json({
        ok: true,
        scope: "admin-profile",
        readOnly: true,
        approvalRequiredBeforeCustomerUse: true,
        ...data,
      });
    }

    if (requestedScope === "admin" && (role === "admin" || role === "sales_agent")) {
      const data = await loadAdminBusinessMemory({ supabase, search });
      return NextResponse.json({
        ok: true,
        scope: "admin",
        readOnly: true,
        approvalRequiredBeforeCustomerUse: true,
        ...data,
      });
    }

    const data = await loadClientBusinessMemory({
      supabase,
      user: { id: user.id, email: user.email },
      autoSync: false,
    });

    return NextResponse.json({
      ok: true,
      scope: "client",
      readOnly: true,
      ...data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Business Memory profile failed.",
        safeMode: true,
      },
      { status: 500 },
    );
  }
}
