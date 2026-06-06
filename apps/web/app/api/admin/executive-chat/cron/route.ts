import { runExecutiveMeetingCron } from "@/lib/executive-meetings/cron-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return runExecutiveMeetingCron(request);
}
