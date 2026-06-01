import { redirect } from "next/navigation";
import { TodayAgentStack } from "@/components/agent-mini-apps/today-agent-stack";
import { roleOf } from "@/lib/auth/api-guards";
import { loadAgentMiniAppsData } from "@/lib/agent-mini-apps/repository";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AgentMiniAppsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const data = await loadAgentMiniAppsData({
    userId: user.id,
    role: roleOf(user),
  });

  return <TodayAgentStack data={data} />;
}
