import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";
import AgentNav from "./agent-nav";

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
    <div className="flex min-h-screen bg-gray-50">
      <Nav />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
    </div>
  );
}
