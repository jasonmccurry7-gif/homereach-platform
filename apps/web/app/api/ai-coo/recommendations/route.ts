import { NextResponse } from "next/server";
import { requireRole, roleOf } from "@/lib/auth/api-guards";
import { isAiCooEnabled } from "@/lib/ai-coo/config";
import {
  loadAdminAiCooQueue,
  loadClientAiCooCommandCenter,
} from "@/lib/ai-coo/recommendations";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAiCooEnabled()) {
    return NextResponse.json({ error: "AI COO is disabled." }, { status: 404 });
  }

  const guard = await requireRole(["admin", "sales_agent", "client"]);
  if (!guard.ok) return guard.response;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "AI COO persistence is not configured.", safeMode: true },
      { status: 503 },
    );
  }

  const user = guard.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = roleOf(user);
  const url = new URL(request.url);
  const requestedScope = url.searchParams.get("scope")?.trim().toLowerCase();
  const adminScope = requestedScope === "admin";

  if (adminScope && role === "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = createServiceClient();

    if (adminScope && (role === "admin" || role === "sales_agent")) {
      const data = await loadAdminAiCooQueue({ supabase });
      return NextResponse.json({
        ok: true,
        scope: "admin",
        approvalRequired: true,
        noAutonomousAction: true,
        ...data,
      });
    }

    const data = await loadClientAiCooCommandCenter({
      supabase,
      user: { id: user.id, email: user.email },
      autoGenerate: false,
    });

    return NextResponse.json({
      ok: true,
      scope: "client",
      approvalRequired: true,
      noAutonomousAction: true,
      ...data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "AI COO recommendations failed.",
        safeMode: true,
        approvalRequired: true,
        noAutonomousAction: true,
      },
      { status: 500 },
    );
  }
}
