import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";

// GET /api/admin/sales/next-lead
// Returns the highest-priority safe lead for an authenticated admin/sales user.
export async function GET(request: Request) {
  try {
    const guard = await requireAdminOrSalesAgent();
    if (!guard.ok) return guard.response;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");
    const category = searchParams.get("category");
    const channel = searchParams.get("channel"); // sms | email | facebook

    let q = supabase
      .from("sales_leads")
      .select("*")
      .eq("do_not_contact", false)
      .in("status", ["queued", "contacted", "replied", "interested"])
      .order("buying_signal", { ascending: false })
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);

    if (channel === "sms") {
      q = q.not("phone", "is", null).not("phone", "eq", "").eq("sms_opt_out", false);
    }
    if (channel === "email") {
      q = q.not("email", "is", null).not("email", "eq", "");
    }
    if (channel === "facebook") {
      q = q.not("facebook_url", "is", null).not("facebook_url", "eq", "");
    }
    if (city) q = q.eq("city", city);
    if (category) q = q.eq("category", category);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ lead: null }, { status: 200 });

    return NextResponse.json({ lead: data[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sales/next-lead] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
