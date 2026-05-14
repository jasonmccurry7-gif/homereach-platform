"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createManualCandidateWithAgent } from "@/lib/political/candidate-launch-agent";
import type { DistrictType, GeographyType } from "@/lib/political/queries";

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function district(value: string | null): DistrictType | null {
  return value === "federal" || value === "state" || value === "local" ? value : null;
}

function geography(value: string | null): GeographyType | null {
  return value === "state" || value === "county" || value === "city" || value === "district"
    ? value
    : null;
}

export async function createCandidateAgentCandidate(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const role = user.app_metadata?.user_role;
  if (role !== "admin" && role !== "sales_agent") throw new Error("Forbidden");

  const result = await createManualCandidateWithAgent(
    {
      candidateName: text(formData, "candidateName") ?? "",
      officeSought: text(formData, "officeSought"),
      state: text(formData, "state"),
      districtType: district(text(formData, "districtType")),
      geographyType: geography(text(formData, "geographyType")),
      geographyValue: text(formData, "geographyValue"),
      electionDate: text(formData, "electionDate"),
      partyOptionalPublic: text(formData, "partyOptionalPublic"),
      campaignWebsite: text(formData, "campaignWebsite"),
      campaignEmail: text(formData, "campaignEmail"),
      campaignPhone: text(formData, "campaignPhone"),
      sourceUrl: text(formData, "sourceUrl"),
      campaignName: text(formData, "campaignName"),
      notes: text(formData, "notes"),
    },
    user.id,
  );

  redirect(`/admin/political/${result.candidateId}`);
}
