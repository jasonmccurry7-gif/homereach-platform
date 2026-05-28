import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GroupIntelligenceClient } from "./group-intelligence-client";
import { loadGroupIntelligenceDashboard } from "@/lib/group-intelligence/repository";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Group Intelligence | HomeReach Admin",
  description:
    "Manual, human-reviewed group pain point intelligence and response drafting for HomeReach.",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GroupIntelligencePage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (user.app_metadata?.user_role !== "admin") redirect("/admin");

  const params = (await searchParams) ?? {};
  const initialData = await loadGroupIntelligenceDashboard({
    status: readParam(params, "status"),
    category: readParam(params, "category"),
    group: readParam(params, "group"),
    query: readParam(params, "q"),
    minScore: numberParam(params, "minScore"),
  });

  return <GroupIntelligenceClient initialData={initialData} />;
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function numberParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = readParam(params, key);
  if (!value || !Number.isFinite(Number(value))) return null;
  return Number(value);
}
