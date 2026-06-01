import { NextResponse } from "next/server";
import { requireRole, roleOf } from "@/lib/auth/api-guards";
import { hasAdTechPersistence, isLaunchPackagesEnabled } from "@/lib/ad-tech/config";
import { loadAdminAdTechCenter, loadClientAdTechCenter } from "@/lib/ad-tech/engine";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isLaunchPackagesEnabled()) {
    return NextResponse.json({ error: "Ad-Tech launch packages are disabled." }, { status: 404 });
  }

  const guard = await requireRole(["admin", "sales_agent", "client"]);
  if (!guard.ok) return guard.response;

  if (!hasAdTechPersistence()) {
    return NextResponse.json(
      { error: "Ad-Tech persistence is not configured.", safeMode: true },
      { status: 503 },
    );
  }

  const user = guard.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = roleOf(user);
  const url = new URL(request.url);
  const adminScope = url.searchParams.get("scope")?.trim().toLowerCase() === "admin";

  if (adminScope && role === "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = createServiceClient();
    const data =
      adminScope && (role === "admin" || role === "sales_agent")
        ? await loadAdminAdTechCenter({ supabase, autoSync: false })
        : await loadClientAdTechCenter({
            supabase,
            user: { id: user.id, email: user.email },
            autoSync: false,
          });

    return NextResponse.json({
      ok: true,
      scope: adminScope && role !== "client" ? "admin" : "client",
      readOnly: true,
      manualLaunchOnly: true,
      noAutoLaunch: true,
      noAutoSpend: true,
      adminApprovalRequiredBeforeLaunch: true,
      ...data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ad-Tech launch packages failed.",
        safeMode: true,
        manualLaunchOnly: true,
        noAutoLaunch: true,
        noAutoSpend: true,
        adminApprovalRequiredBeforeLaunch: true,
      },
      { status: 500 },
    );
  }
}
