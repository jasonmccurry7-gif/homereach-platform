import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "./dashboard-nav";

export const dynamic = "force-dynamic";

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

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <DashboardNav role={role} />
      <main className="min-w-0 flex-1 overflow-y-auto p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:p-6 lg:p-8 lg:pb-8">
        {children}
      </main>
    </div>
  );
}
