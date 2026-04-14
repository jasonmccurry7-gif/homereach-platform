import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

// PUT /api/admin/pricing/bundle
// Body: { bundleId, standardPrice, foundingPrice } — in DOLLARS (convert to cents)

export async function PUT(req: Request) {
  const db = createServiceClient();
  const { bundleId, standardPrice, foundingPrice } = await req.json();

  const { error } = await db.from("bundles").update({
    standard_price: Math.round(standardPrice * 100),
    founding_price: Math.round(foundingPrice * 100),
    price: foundingPrice, // keep display price = founding price
  }).eq("id", bundleId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
