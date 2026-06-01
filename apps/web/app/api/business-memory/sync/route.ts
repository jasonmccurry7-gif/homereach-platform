import { NextResponse } from "next/server";
import { hasBusinessMemoryPersistence, isBusinessMemoryEnabled } from "@/lib/business-memory/config";
import { ensureBusinessMemoryForClient } from "@/lib/business-memory/memory";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isBusinessMemoryEnabled()) {
    return NextResponse.json({ ok: false, error: "Business Memory is disabled." }, { status: 404 });
  }

  if (!hasBusinessMemoryPersistence()) {
    return NextResponse.json(
      { ok: false, error: "Business Memory persistence is not configured.", safeMode: true },
      { status: 503 },
    );
  }

  try {
    const result = await ensureBusinessMemoryForClient({
      supabase: createServiceClient(),
      clientId: user.id,
      clientEmail: user.email,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Business Memory sync failed." },
      { status: 500 },
    );
  }
}
