import type { Metadata } from "next";
import { DailyOutreachClient } from "./daily-outreach-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Daily Outreach Command Center - HomeReach Admin",
};

export default function DailyOutreachPage() {
  return <DailyOutreachClient />;
}
