import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import AgentHome from "./agent-home";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agent View — HomeReach Sales" };

export default async function AgentViewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin/agent-view");

  // Get agent's name for personalization
  const db = createServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AgentHome
      agentId={user.id}
      agentName={profile?.full_name ?? "Agent"}
    />
  );
}
