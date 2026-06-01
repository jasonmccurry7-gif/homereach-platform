import { notFound, redirect } from "next/navigation";
import { GrowthOsShell } from "@/components/growth-os/growth-os-shell";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { isGrowthOsEnabled } from "@/lib/growth-os/feature-flag";

export const dynamic = "force-dynamic";

export default async function GrowthOsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isGrowthOsEnabled()) notFound();

  const user = await getGrowthOsSessionUser();
  if (!user) redirect("/login?redirect=/growth-os");

  return <GrowthOsShell>{children}</GrowthOsShell>;
}
