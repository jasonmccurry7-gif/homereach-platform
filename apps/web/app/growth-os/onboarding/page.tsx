import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/growth-os/profile-form";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { getGrowthOsProfile } from "@/lib/growth-os/queries";

export default async function GrowthOsOnboardingPage() {
  const user = await getGrowthOsSessionUser();
  if (!user) redirect("/login?redirect=/growth-os/onboarding");

  const profile = await getGrowthOsProfile(user.id);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
          Business profile
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">
          Set your operating baseline
        </h1>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <ProfileForm
          initial={
            profile
              ? {
                  companyName: profile.companyName,
                  locationZip: profile.locationZip,
                  businessType: profile.businessType,
                  weeklyRevenueCents: profile.weeklyRevenueCents,
                  avgOrderValueCents: profile.avgOrderValueCents,
                  dailyCustomers: profile.dailyCustomers,
                  laborCostWeeklyCents: profile.laborCostWeeklyCents,
                  ingredientCostWeeklyCents: profile.ingredientCostWeeklyCents,
                  overheadMonthlyCents: profile.overheadMonthlyCents,
                  ownerGoal: profile.ownerGoal,
                  timezone: profile.timezone,
                }
              : null
          }
        />
      </section>
    </div>
  );
}
