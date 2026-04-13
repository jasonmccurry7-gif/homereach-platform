import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AgentDashboard from "./agent-dashboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Agent View — HomeReach Sales" };

export default async function AgentViewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin/agent-view");

  return <AgentDashboard agentId={user.id} />;
}
