// ─────────────────────────────────────────────────────────────────────────────
// /admin/content-intel — Admin control surface for the Content Intelligence
// pipeline. Shows: ingestion queue, latest insights, review/approval.
// Flag-gated by the API — if ENABLE_CONTENT_INTEL=false all fetches 404
// and the page renders an empty state.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ContentIntelAdminClient from "./content-intel-admin-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Content Intelligence — HomeReach Admin" };

export default async function ContentIntelAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin/content-intel");
  return <ContentIntelAdminClient />;
}
