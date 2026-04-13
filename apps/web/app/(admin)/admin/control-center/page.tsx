import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ControlCenterClient from "./control-center-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Control Center | HomeReach Admin" };

export default async function ControlCenterPage() {
  const devBypass = process.env.ADMIN_DEV_BYPASS === "true";

  if (!devBypass) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const role = user.app_metadata?.user_role as string;
    if (role !== "admin") redirect("/dashboard");
  }

  return <ControlCenterClient />;
}
