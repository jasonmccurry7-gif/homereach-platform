import { redirect } from "next/navigation";
import { ExecutiveBoardroom } from "@/components/executive-chat/executive-boardroom";
import { loadExecutiveChatData } from "@/lib/executive-meetings/repository";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExecutiveChatPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = (await searchParams) ?? {};
  const rawMeetingId = params.meetingId;
  const requestedMeetingId = Array.isArray(rawMeetingId) ? rawMeetingId[0] : rawMeetingId;
  const data = await loadExecutiveChatData();
  return <ExecutiveBoardroom data={data} requestedMeetingId={requestedMeetingId ?? null} />;
}
