import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";
import AgentNav from "./agent-nav";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Layout
// Secondary auth check (middleware is primary).
// Admins can access /admin/*; sales agents are limited by middleware to agent view.
// ─────────────────────────────────────────────────────────────────────────────

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = user.app_metadata?.user_role as string;
  if (role !== "admin" && role !== "sales_agent") redirect("/dashboard");

  const Nav = role === "sales_agent" ? AgentNav : AdminNav;

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <Nav />
      <main className="min-w-0 flex-1 overflow-y-auto p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:p-6 lg:p-8 lg:pb-8">
        {children}
      </main>
    </div>
  );
}
