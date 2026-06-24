import { NextResponse } from "next/server";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { createGuardedServiceRoleClient } from "@/lib/security/guarded-service-role";

export const dynamic = "force-dynamic";

type Params = Promise<{ assetId: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  const { assetId } = await params;
  const { supabase } = createGuardedServiceRoleClient({
    allowedRoles: ["admin", "sales_agent"],
    guard,
    purpose: "Download StormReach generated asset",
    route: "/api/admin/stormreach/assets/[assetId]",
  });
  const { data, error } = await supabase
    .from("storm_generated_assets")
    .select("id,title,format,content_text")
    .eq("id", assetId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ ok: false, error: "Asset not found." }, { status: 404 });

  const format = String(data.format ?? "txt");
  const content = String(data.content_text ?? "");
  const extension = format === "svg" ? "svg" : format === "html" ? "html" : "txt";
  const contentType = format === "svg"
    ? "image/svg+xml; charset=utf-8"
    : format === "html"
      ? "text/html; charset=utf-8"
      : "text/plain; charset=utf-8";

  return new NextResponse(content, {
    headers: {
      "content-type": contentType,
      "content-disposition": `inline; filename="${safeName(String(data.title ?? "stormreach-asset"))}.${extension}"`,
      "cache-control": "no-store",
    },
  });
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "stormreach-asset";
}
