import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/admin/sales/leads
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const status   = searchParams.get("status");
  const city     = searchParams.get("city");
  const category = searchParams.get("category");
  const limit    = parseInt(searchParams.get("limit") ?? "50");
  const offset   = parseInt(searchParams.get("offset") ?? "0");
  const search   = searchParams.get("q");

  let q = supabase
    .from("sales_leads")
    .select("*", { count: "exact" })
    .order("buying_signal", { ascending: false })
    .order("score", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status)   q = q.eq("status", status);
  if (city)     q = q.eq("city", city);
  if (category) q = q.eq("category", category);
  if (search)   q = q.ilike("business_name", `%${search}%`);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leads: data, total: count, limit, offset });
}
