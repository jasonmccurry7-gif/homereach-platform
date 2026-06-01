import { redirect } from "next/navigation";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { getGrowthOsProfile } from "@/lib/growth-os/queries";

export default async function GrowthOsIndexPage() {
  const user = await getGrowthOsSessionUser();
  if (!user) redirect("/login?redirect=/growth-os");

  const profile = await getGrowthOsProfile(user.id);
  redirect(profile ? "/growth-os/dashboard" : "/growth-os/onboarding");
}
