import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "./dashboard-nav";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Layout
// Wraps all /dashboard/* routes with auth check + sidebar nav.
// Role is read from session — admin users see admin-specific nav items.
// ─────────────────────────────────────────────────────────────────────────────

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = (user.app_metadata?.user_role as string) ?? "client";
  const userEmail = user.email;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardNav role={role} userEmail={userEmail} />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
    </div>
  );
}
