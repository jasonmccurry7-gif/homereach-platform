import { redirect } from "next/navigation";
import { LeverLibrary } from "@/components/growth-os/lever-library";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { getGrowthOsProfile, getGrowthOsWinLog } from "@/lib/growth-os/queries";

export default async function GrowthOsLeverLibraryPage() {
  const user = await getGrowthOsSessionUser();
  if (!user) redirect("/login?redirect=/growth-os/levers");

  const profile = await getGrowthOsProfile(user.id);
  if (!profile) redirect("/growth-os/onboarding");

  const entries = await getGrowthOsWinLog(user.id, 100);
  return <LeverLibrary entries={entries} />;
}
