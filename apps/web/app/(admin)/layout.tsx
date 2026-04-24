import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isPoliticalEnabled } from "@/lib/political/env";
import { AdminNav } from "./admin-nav";
import AgentNav from "./agent-nav";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Layout
// Admits: admin (full access) and sales_agent (agent-view only)
// ─────────────────────────────────────────────────────────────────────────────

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const devBypass = process.env.ADMIN_DEV_BYPASS === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (devBypass && isProduction) {
    throw new Error(
      "SECURITY VIOLATION: ADMIN_DEV_BYPASS=true is set in a production environment. " +
      "Remove ADMIN_DEV_BYPASS from your production environment variables immediately."
    );
  }

  let role = "admin"; // default for devBypass

  if (!devBypass) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    role = (user.app_metadata?.user_role as string) ?? "";

    // Admins: full access
    // sales_agents: middleware already restricts them to /admin/agent-view
    // Everyone else: back to dashboard
    if (role !== "admin" && role !== "sales_agent") {
      redirect("/dashboard");
    }
  }

  const isAgent = role === "sales_agent";

  // Additive: pass per-subsystem flags to the nav so optional entries render
  // only when their flag is on. Default remains "off" so pre-existing nav
  // entries are unaffected.
  const enablePolitical = isPoliticalEnabled();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {isAgent ? <AgentNav /> : <AdminNav enablePolitical={enablePolitical} />}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
    </div>
  );
}
