import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import FacebookExecutionClient from "./facebook-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Facebook Execution — HomeReach" };

export default async function FacebookExecutionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <FacebookExecutionClient agentId={user.id} />;
}
