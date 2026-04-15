import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/admin/sales/call-scripts?category=roofing
export async function GET(request: Request) {
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    if (!category) {
      return NextResponse.json({ error: "category required" }, { status: 400 });
    }

    // Query: exact category match first, then 'all', then by variant
    const { data: scripts, error } = await supabase
      .from("call_scripts")
      .select("id, category, variant, label, script")
      .eq("is_active", true)
      .or(`category.eq.${category},category.eq.all`)
      .order("category", { ascending: false }) // 'all' comes after exact match alphabetically reversed
      .order("variant", { ascending: true })
      .limit(3);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sort locally to ensure exact category match comes first
    const sorted = (scripts || []).sort((a, b) => {
      if (a.category === category && b.category !== category) return -1;
      if (a.category !== category && b.category === category) return 1;
      return 0;
    });

    return NextResponse.json({
      scripts: sorted.slice(0, 3),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[call-scripts GET] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/admin/sales/call-scripts (admin only)
export async function PUT(request: Request) {
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Add admin role check here
    // For now, assuming authenticated users can update (should be restricted to admins in production)

    const supabase = createServiceClient();
    const body = await request.json();
    const { id, script, label, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (script !== undefined) updates.script = script;
    if (label !== undefined) updates.label = label;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from("call_scripts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      script: updated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[call-scripts PUT] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/sales/call-scripts (admin only)
export async function POST(request: Request) {
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Add admin role check here
    // For now, assuming authenticated users can create (should be restricted to admins in production)

    const supabase = createServiceClient();
    const body = await request.json();
    const { category, variant, label, script } = body;

    if (!category || !variant || !label || !script) {
      return NextResponse.json(
        { error: "category, variant, label, and script are required" },
        { status: 400 }
      );
    }

    const { data: newScript, error } = await supabase
      .from("call_scripts")
      .insert({
        category,
        variant,
        label,
        script,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      script: newScript,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[call-scripts POST] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
