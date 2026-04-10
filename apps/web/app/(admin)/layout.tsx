import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Layout
// Secondary auth check (middleware is primary).
// Only users with role = 'admin' can access /admin/*.
// ─────────────────────────────────────────────────────────────────────────────

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const devBypass = process.env.ADMIN_DEV_BYPASS === "true";
  const isProduction = process.env.NODE_ENV === "production";

  // ── Hard production safety check ─────────────────────────────────────────
  // ADMIN_DEV_BYPASS=true in production exposes ALL admin routes with zero auth.
  // This is a critical security failure. Crash loudly rather than silently serve.
  if (devBypass && isProduction) {
    throw new Error(
      "SECURITY VIOLATION: ADMIN_DEV_BYPASS=true is set in a production environment. " +
      "This completely disables admin authentication. " +
      "Remove ADMIN_DEV_BYPASS from your production environment variables immediately."
    );
  }

  if (!devBypass) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const role = user.app_metadata?.user_role as string;
    if (role !== "admin") redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminNav />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
    </div>
  );
}
