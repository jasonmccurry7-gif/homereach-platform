import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadFoundationControlTower } from "@/lib/control-tower/foundation";
import ControlCenterClient from "./control-center-client";
import { FoundationControlTower } from "./foundation-control-tower";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Foundation Control Tower | HomeReach Admin" };

export default async function ControlCenterPage() {
  const devBypass = process.env.ADMIN_DEV_BYPASS === "true";

  if (!devBypass) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const role = user.app_metadata?.user_role as string;
    if (role !== "admin") redirect("/dashboard");
  }

  const tower = await loadFoundationControlTower();

  return (
    <>
      <FoundationControlTower data={tower} />
      <ControlCenterClient />
    </>
  );
}
