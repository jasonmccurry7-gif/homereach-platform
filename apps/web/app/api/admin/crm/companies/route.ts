import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let q = supabase
    .from("crm_companies")
    .select("*, crm_deals(id, monthly_value_cents, status, city, category)")
    .order("mrr_cents", { ascending: false });

  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalMRR = (data ?? []).reduce((s, c) => s + (c.mrr_cents ?? 0), 0);
  return NextResponse.json({ companies: data, total_mrr_cents: totalMRR });
}
