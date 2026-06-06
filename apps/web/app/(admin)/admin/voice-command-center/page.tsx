import { redirect } from "next/navigation";
import { VoiceCommandCenter } from "@/components/voice-command-center/voice-command-center";
import { roleOf } from "@/lib/auth/api-guards";
import { createClient } from "@/lib/supabase/server";
import { loadVoiceCommandCenterData } from "@/lib/voice-command-center/repository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Voice Approval Command Center - HomeReach Admin",
};

export default async function VoiceCommandCenterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (roleOf(user) !== "admin") redirect("/admin");

  const data = await loadVoiceCommandCenterData();
  return <VoiceCommandCenter data={data} />;
}
