import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CRMClient from "./crm-client";

export const metadata = { title: "CRM | HomeReach Admin" };

export default async function CRMPage() {
  const devBypass = process.env.ADMIN_DEV_BYPASS === "true";

  let agentId = "dev-agent";
  if (!devBypass) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    agentId = user.id;
  }

  return <CRMClient agentId={agentId} />;
}
