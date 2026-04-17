import { createServiceClient } from "@/lib/supabase/service";
import { redirect }            from "next/navigation";
import { cookies }             from "next/headers";
import { createServerClient }  from "@supabase/ssr";
import OperatorClient          from "./operator-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operator Command Center — HomeReach" };

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

export default async function OperatorPage() {
  const user = await getSessionUser();
  if (!user || user.app_metadata?.user_role !== "admin") {
    redirect("/admin");
  }

  // Fetch initial data server-side — client will auto-refresh every 30s
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";
  let initialData = null;
  try {
    const res = await fetch(`${baseUrl}/api/admin/operator/summary`, { cache: "no-store" });
    if (res.ok) initialData = await res.json();
  } catch {
    // Client will load data on mount
  }

  return <OperatorClient initialData={initialData} />;
}
