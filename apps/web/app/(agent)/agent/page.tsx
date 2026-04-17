import { cookies }            from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect }           from "next/navigation";
import AgentHomeClient        from "./agent-home-client";

export const dynamic = "force-dynamic";

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export default async function AgentHomePage() {
  const user = await getUser();
  if (!user) redirect("/login?redirect=/agent");

  return <AgentHomeClient agentId={user.id} agentName={user.user_metadata?.full_name ?? user.email ?? "Agent"} />;
}
