import { DailyContentCenter } from "@/components/daily-content/daily-content-center";
import { getContentDate } from "@/lib/daily-content/generator";
import { getDailyContentSummary } from "@/lib/daily-content/repository";

export const metadata = {
  title: "AI Reel Command Center - HomeReach Admin",
};

export default async function DailyContentPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const contentDate = params.date ?? getContentDate();
  const summary = await getDailyContentSummary(contentDate);

  return <DailyContentCenter summary={summary} />;
}
