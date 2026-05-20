import { redirect } from "next/navigation";
import { AbTestForm } from "@/components/growth-os/ab-test-form";
import { AbTestList } from "@/components/growth-os/ab-test-list";
import { getGrowthOsAbTests } from "@/lib/growth-os/ab-tests";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import {
  getGrowthOsActiveAppliedRecommendation,
  getGrowthOsProfile,
} from "@/lib/growth-os/queries";

export default async function GrowthOsExperimentsPage() {
  const user = await getGrowthOsSessionUser();
  if (!user) redirect("/login?redirect=/growth-os/experiments");

  const [profile, activeAppliedRecommendation, abTests] = await Promise.all([
    getGrowthOsProfile(user.id),
    getGrowthOsActiveAppliedRecommendation(user.id),
    getGrowthOsAbTests(user.id, 30),
  ]);

  if (!profile) redirect("/growth-os/onboarding");

  const hasActiveTest = abTests.some((test) => test.status === "active");
  const canCreate = Boolean(activeAppliedRecommendation) && !hasActiveTest;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
          Experiments
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">
          Light A/B Testing
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Run one pricing or bundle variation test at a time against the active
          lever. Results are directional and use weekly inputs.
        </p>
      </section>

      <AbTestForm disabled={!canCreate} />
      <AbTestList tests={abTests} />
    </div>
  );
}
