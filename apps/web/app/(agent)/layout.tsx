import type { Metadata } from "next";
import { redirect }      from "next/navigation";
import { cookies }       from "next/headers";
import { createServerClient } from "@supabase/ssr";
import AgentBottomNav    from "./agent-bottom-nav";

export const metadata: Metadata = { title: "HomeReach Agent", description: "Mobile sales agent dashboard" };

async function getSessionUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  // Check ENABLE_AGENT_MOBILE flag — when OFF, 404 this route group
  if (process.env.ENABLE_AGENT_MOBILE !== "true") {
    redirect("/admin/agent-view");
  }

  const user = await getSessionUser();
  if (!user) redirect(`/login?redirect=/agent`);

  const role = user.app_metadata?.user_role as string;
  if (role !== "admin" && role !== "sales_agent") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col max-w-md mx-auto relative">
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      <AgentBottomNav />
    </div>
  );
}
