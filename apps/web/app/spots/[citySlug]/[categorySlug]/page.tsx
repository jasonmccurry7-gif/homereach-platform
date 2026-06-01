import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ citySlug: string; categorySlug: string }>;
}

export default async function LegacySpotRedirectPage({ params }: Props) {
  const { citySlug, categorySlug } = await params;
  redirect(`/get-started/${citySlug}/${categorySlug}`);
}
