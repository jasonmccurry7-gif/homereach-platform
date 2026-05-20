import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isGrowthEngineEnabled } from "@/lib/growth-engine/env";
import { createClient } from "@/lib/supabase/server";
import { GrowthEngineClient } from "./growth-engine-client";

export const metadata: Metadata = {
  title: "Growth Engine - HomeReach Admin",
  description:
    "Internal HomeReach Growth Engine for SEO, content, social, postcard, political, and revenue workflow orchestration.",
};

export default async function GrowthEnginePage() {
  if (!isGrowthEngineEnabled()) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin/growth-engine");
  }

  return <GrowthEngineClient userEmail={user.email ?? "admin"} />;
}
