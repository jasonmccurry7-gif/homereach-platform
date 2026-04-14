import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

// GET /api/admin/sales/next-lead
// Returns the highest-priority uncontacted lead
// Priority: HIGH buying_signal first → score DESC → created_at ASC
export async function GET(request: Request) {
  try {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const city     = searchParams.get("city");
  const category = searchParams.get("category");
  const channel  = searchParams.get("channel"); // sms | email | facebook

  let query = supabase
    .from("sales_leads")
    .select("*")
    .eq("do_not_contact", false)
    .eq("sms_opt_out", channel === "sms" ? true : false)
    .in("status", ["queued", "contacted"])
    .order("buying_signal", { ascending: false })
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1);

  // Channel filter: SMS needs phone, email needs email, facebook needs fb URL
  if (channel === "sms")      query = query.not("phone", "is", null);
  if (channel === "email")    query = query.not("email", "is", null);
  if (channel === "facebook") query = query.not("facebook_url", "is", null);

  if (city)     query = query.eq("city", city);
  if (category) query = query.eq("category", category);

  // Remove the sms_opt_out filter clash — re-do cleanly
  let q = supabase
    .from("sales_leads")
    .select("*")
    .eq("do_not_contact", false)
    .in("status", ["queued", "contacted"])
    .order("buying_signal", { ascending: false })
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1);

  if (channel === "sms")      { q = q.not("phone", "is", null); q = q.not("phone", "eq", ""); q = q.eq("sms_opt_out", false); }
  if (channel === "email")    { q = q.not("email", "is", null); q = q.not("email", "eq", ""); }
  if (channel === "facebook") { q = q.not("facebook_url", "is", null); q = q.not("facebook_url", "eq", ""); }
  if (city)     q = q.eq("city", city);
  if (category) q = q.eq("category", category);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ lead: null }, { status: 200 });

  return NextResponse.json({ lead: data[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

}
