import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/founding/slots
// Returns all founding_slots with usage stats
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const db = createServiceClient();

  try {
    const { data: slots, error } = await db
      .from("founding_slots")
      .select("*")
      .order("city", { ascending: true })
      .order("tier", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      slots: slots || [],
    });
  } catch (error) {
    console.error("Error fetching founding slots:", error);
    return NextResponse.json(
      { error: "Failed to fetch founding slots" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/founding/slots
// Updates founding_open and/or total_slots for a slot record
// Body: { id, founding_open?, total_slots? }
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(req: Request) {
  const db = createServiceClient();

  try {
    const body = await req.json();
    const { id, founding_open, total_slots } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    if (founding_open !== undefined) updates.founding_open = founding_open;
    if (total_slots !== undefined) updates.total_slots = total_slots;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "At least one field must be updated" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await db
      .from("founding_slots")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating founding slot:", error);
    return NextResponse.json(
      { error: "Failed to update founding slot" },
      { status: 500 }
    );
  }
}
