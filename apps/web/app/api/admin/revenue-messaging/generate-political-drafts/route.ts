import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import {
  generateCandidateLaunchPlan,
  generateSalesFollowUpDraft,
  hasCandidateDirectPoliticalOutreachEmail,
  loadCandidateAgentWorkspace,
  normalizePoliticalOutreachEmail,
  politicalCandidateQualityBlockers,
} from "@/lib/political/candidate-launch-agent";
import { findStrategySelectionCandidate } from "@/lib/political/campaign-strategy-selection";
import type { CandidateRow } from "@/lib/political/queries";
import { loadCandidates } from "@/lib/political/queries";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExistingApproval = {
  metadata: Record<string, unknown> | null;
};

type SupabaseAdminClient = ReturnType<typeof createServiceClient>;

type PoliticalSalesLeadRow = {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  facebook_url: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  score: number | null;
  priority: string | null;
  status: string | null;
  do_not_contact: boolean | null;
  email_status: string | null;
  notes: string | null;
  created_at: string | null;
};

function parseLimit(value: unknown) {
  const parsed = Number(value ?? 8);
  if (!Number.isFinite(parsed)) return 8;
  return Math.min(Math.max(Math.trunc(parsed), 1), 20);
}

function metadataCandidateId(row: ExistingApproval): string | null {
  const candidateId = row.metadata?.candidate_id;
  return typeof candidateId === "string" && candidateId ? candidateId : null;
}

function metadataRecipientEmail(row: ExistingApproval): string | null {
  const email =
    typeof row.metadata?.to_email === "string"
      ? row.metadata.to_email
      : typeof row.metadata?.contact_email === "string"
        ? row.metadata.contact_email
        : null;
  return normalizePoliticalOutreachEmail(email);
}

function candidateDirectRecipientEmail(candidate: CandidateRow): string | null {
  return (
    normalizePoliticalOutreachEmail(candidate.campaignManagerEmail) ??
    normalizePoliticalOutreachEmail(candidate.campaignEmail)
  );
}

function isSuppressedEmailStatus(value: string | null | undefined) {
  return ["bounced_permanent", "complained", "unsubscribed"].includes(
    String(value ?? "").toLowerCase(),
  );
}

function cleanCandidateNameFromLeadName(value: string): string {
  return value
    .replace(/\s+(campaign|committee|for congress|for ohio|for senate|for governor)$/i, "")
    .replace(
      /\s+for\s+(ohio\s+)?(attorney general|secretary of state|auditor|treasurer|congress|senate|governor|state representative|state senate|us house|u\.s\. house)$/i,
      "",
    )
    .replace(/^friends of\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || value.trim().slice(0, 160);
}

function inferOfficeFromLeadName(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes("attorney general")) return "Attorney General";
  if (lower.includes("secretary of state")) return "Secretary of State";
  if (lower.includes("auditor")) return "Auditor of State";
  if (lower.includes("treasurer")) return "Treasurer of State";
  if (lower.includes("governor")) return "Governor";
  if (lower.includes("senate")) return "U.S. Senate";
  if (lower.includes("congress") || lower.includes("u.s. house") || lower.includes("us house")) return "U.S. House";
  if (lower.includes("state representative") || lower.includes("state rep")) return "State Representative";
  if (lower.includes("state senate")) return "State Senator";
  return "Campaign mail prospect";
}

function districtTypeForOffice(office: string): "federal" | "state" | "local" {
  const lower = office.toLowerCase();
  if (lower.includes("u.s.") || lower.includes("congress") || lower.includes("senate")) return "federal";
  if (
    lower.includes("governor") ||
    lower.includes("attorney general") ||
    lower.includes("secretary of state") ||
    lower.includes("auditor") ||
    lower.includes("treasurer") ||
    lower.includes("state ")
  ) {
    return "state";
  }
  return "local";
}

function inferGeography(city: string | null): {
  geographyType: "county" | "city" | "state";
  geographyValue: string;
} {
  const value = city?.trim();
  if (!value) return { geographyType: "state", geographyValue: "Ohio" };
  if (/\bcounty$/i.test(value)) return { geographyType: "county", geographyValue: value };
  return { geographyType: "city", geographyValue: value };
}

function candidateGenerationScore(candidate: CandidateRow): number {
  if (politicalCandidateQualityBlockers(candidate).length > 0) return -100_000;
  let score = Number(candidate.priorityScore ?? 0);
  if (hasCandidateDirectPoliticalOutreachEmail(candidate)) score += 10_000;
  if (candidate.sourceUrl) score += 80;
  if (candidate.campaignWebsite) score += 60;
  if (candidate.officeSought) score += 30;
  if (candidate.geographyValue) score += 20;
  if (candidate.electionDate || candidate.electionYear) score += 15;
  return score;
}

async function syncPoliticalSalesLeadsToCandidates(supabase: SupabaseAdminClient): Promise<{
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}> {
  const result = { imported: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const { data, error } = await supabase
    .from("sales_leads")
    .select("id,business_name,contact_name,email,phone,website,facebook_url,city,state,category,score,priority,status,do_not_contact,email_status,notes,created_at")
    .ilike("category", "%Political%")
    .eq("do_not_contact", false)
    .not("email", "is", null)
    .order("score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    return { ...result, errors: [`Could not load political sales leads: ${error.message}`] };
  }

  for (const lead of (data ?? []) as PoliticalSalesLeadRow[]) {
    const email = normalizePoliticalOutreachEmail(lead.email);
    const candidateName = cleanCandidateNameFromLeadName(lead.business_name ?? "");
    if (!email || !candidateName || lead.do_not_contact || isSuppressedEmailStatus(lead.email_status)) {
      result.skipped += 1;
      continue;
    }

    const state = (lead.state || "OH").trim().toUpperCase().slice(0, 2) || "OH";
    const strategyCandidate = findStrategySelectionCandidate(candidateName);
    const officeSought = strategyCandidate?.office ?? inferOfficeFromLeadName(lead.business_name);
    const districtType = districtTypeForOffice(officeSought);
    const geography = strategyCandidate
      ? {
          geographyType: strategyCandidate.district?.toLowerCase().includes("district")
            ? "district"
            : strategyCandidate.county?.toLowerCase() === "statewide"
              ? "state"
              : "county",
          geographyValue:
            strategyCandidate.district ||
            strategyCandidate.county ||
            strategyCandidate.geography ||
            "Ohio",
        }
      : inferGeography(lead.city);
    const priorityScore = Math.min(95, Math.max(65, Number(lead.score ?? 70)));
    const now = new Date().toISOString();

    const existing = await supabase
      .from("campaign_candidates")
      .select("id,campaign_email,campaign_manager_email,office_sought,district_type,geography_type,geography_value,priority_score,completeness_score,source_type,source_url,do_not_contact,do_not_email,do_not_text")
      .eq("state", state)
      .ilike("candidate_name", candidateName)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing.error) {
      result.errors.push(`${candidateName}: ${existing.error.message}`);
      continue;
    }

    let candidateId: string | null = existing.data?.id ?? null;
    if (existing.data?.do_not_contact || existing.data?.do_not_email) {
      result.skipped += 1;
      continue;
    }
    if (candidateId) {
      const { error: updateError } = await supabase
        .from("campaign_candidates")
        .update({
          campaign_email: existing.data?.campaign_email ?? email,
          office_sought:
            !existing.data?.office_sought || existing.data.office_sought === "Campaign mail prospect"
              ? officeSought
              : existing.data.office_sought,
          district_type: existing.data?.district_type ?? districtType,
          geography_type: existing.data?.geography_type ?? geography.geographyType,
          geography_value: existing.data?.geography_value ?? geography.geographyValue,
          campaign_phone: lead.phone ?? undefined,
          campaign_website: lead.website ?? undefined,
          facebook_url: lead.facebook_url ?? undefined,
          campaign_manager_name: lead.contact_name ?? undefined,
          campaign_manager_email: existing.data?.campaign_manager_email ?? email,
          source_type: existing.data?.source_type ?? "sales_leads_political",
          source_url: existing.data?.source_url ?? lead.website ?? lead.facebook_url ?? null,
          data_verified_at: now,
          completeness_score: Math.max(Number(existing.data?.completeness_score ?? 0), 72),
          priority_score: Math.max(Number(existing.data?.priority_score ?? 0), priorityScore),
          updated_at: now,
        })
        .eq("id", candidateId);
      if (updateError) {
        result.errors.push(`${candidateName}: ${updateError.message}`);
        continue;
      }
      result.updated += 1;
    } else {
      const created = await supabase
        .from("campaign_candidates")
        .insert({
          candidate_name: candidateName,
          office_sought: officeSought,
          race_level: districtType,
          district_type: districtType,
          state,
          geography_type: geography.geographyType,
          geography_value: geography.geographyValue,
          campaign_email: email,
          campaign_phone: lead.phone,
          campaign_website: lead.website,
          facebook_url: lead.facebook_url,
          campaign_manager_name: lead.contact_name,
          campaign_manager_email: email,
          source_type: "sales_leads_political",
          source_url: lead.website ?? lead.facebook_url ?? null,
          data_verified_at: now,
          completeness_score: 72,
          priority_score: priorityScore,
          candidate_status: "active",
          status: "new",
          notes: [
            "Imported from political sales_leads for reviewed outreach draft generation.",
            lead.notes,
            `sales_lead_id:${lead.id}`,
          ]
            .filter(Boolean)
            .join("\n"),
        })
        .select("id")
        .single();
      if (created.error) {
        result.errors.push(`${candidateName}: ${created.error.message}`);
        continue;
      }
      candidateId = created.data.id;
      result.imported += 1;
    }

    const contact = await supabase
      .from("political_campaign_contacts")
      .select("id,do_not_contact,do_not_email")
      .eq("campaign_candidate_id", candidateId)
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    if (contact.data?.do_not_contact || contact.data?.do_not_email) {
      result.skipped += 1;
      continue;
    }

    if (!contact.error && !contact.data?.id) {
      const { error: contactError } = await supabase.from("political_campaign_contacts").insert({
        campaign_candidate_id: candidateId,
        name: lead.contact_name || `${candidateName} campaign team`,
        role: "Campaign contact",
        email,
        phone: lead.phone,
        is_primary: true,
        preferred_contact_method: "email",
        do_not_contact: false,
        do_not_email: false,
        do_not_text: false,
      });
      if (contactError) result.errors.push(`${candidateName} contact: ${contactError.message}`);
    }
  }

  return result;
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as {
    limit?: number;
    ensurePlan?: boolean;
    mode?: "first_touch" | "due_followups";
  };
  const limit = parseLimit(body.limit);
  const ensurePlan = body.ensurePlan !== false;
  const mode = body.mode === "due_followups" ? "due_followups" : "first_touch";
  const allowedStages = mode === "due_followups" ? (["follow_up"] as const) : (["first_touch"] as const);
  const supabase = createServiceClient();
  const leadSync = await syncPoliticalSalesLeadsToCandidates(supabase);

  const { data: existing, error: existingError } = await supabase
    .from("revenue_message_approval_queue")
    .select("metadata")
    .eq("business_line", "political")
    .eq("channel", "email")
    .in("status", ["draft", "needs_review", "approved", "scheduled"])
    .filter("metadata->>workflow", "eq", "candidate_agent_sales_follow_up")
    .limit(500);

  if (existingError) {
    return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
  }

  const alreadyQueued = new Set(
    ((existing ?? []) as ExistingApproval[])
      .map(metadataCandidateId)
      .filter((candidateId): candidateId is string => Boolean(candidateId)),
  );
  const queuedRecipientEmails = new Set(
    ((existing ?? []) as ExistingApproval[])
      .map(metadataRecipientEmail)
      .filter((email): email is string => Boolean(email)),
  );
  const generatedRecipientEmails = new Set<string>();

  const candidates = (await loadCandidates({ state: "OH", candidateStatus: "active" }, 350))
    .sort((a, b) => candidateGenerationScore(b) - candidateGenerationScore(a));
  const results: Array<{
    candidateId: string;
    candidateName: string;
    status: "generated" | "skipped_existing" | "missing_requirements" | "failed";
    approvalId?: string | null;
    toEmail?: string | null;
    outreachStage?: "first_touch" | "follow_up";
    copyVariantKey?: string | null;
    error?: string;
    missingRequirements?: string[];
  }> = [];

  let generated = 0;
  let skippedExisting = 0;
  let missingRequirements = 0;

  for (const candidate of candidates) {
    if (generated >= limit) break;
    if (alreadyQueued.has(candidate.id)) {
      skippedExisting += 1;
      results.push({
        candidateId: candidate.id,
        candidateName: candidate.candidateName,
        status: "skipped_existing",
      });
      continue;
    }
    const directRecipientEmail = candidateDirectRecipientEmail(candidate);
    if (
      directRecipientEmail &&
      (queuedRecipientEmails.has(directRecipientEmail) || generatedRecipientEmails.has(directRecipientEmail))
    ) {
      skippedExisting += 1;
      results.push({
        candidateId: candidate.id,
        candidateName: candidate.candidateName,
        status: "skipped_existing",
        toEmail: directRecipientEmail,
        missingRequirements: ["A draft is already queued for this campaign email."],
      });
      continue;
    }
    if (candidate.doNotContact || candidate.doNotEmail) {
      missingRequirements += 1;
      results.push({
        candidateId: candidate.id,
        candidateName: candidate.candidateName,
        status: "missing_requirements",
        missingRequirements: ["Candidate is marked do-not-contact or do-not-email."],
      });
      continue;
    }
    const qualityBlockers = politicalCandidateQualityBlockers(candidate);
    if (qualityBlockers.length > 0) {
      missingRequirements += 1;
      results.push({
        candidateId: candidate.id,
        candidateName: candidate.candidateName,
        status: "missing_requirements",
        missingRequirements: qualityBlockers,
      });
      continue;
    }

    try {
      if (ensurePlan) {
        const workspace = await loadCandidateAgentWorkspace(candidate.id);
        if (!workspace.latestPlan) {
          await generateCandidateLaunchPlan(candidate.id, guard.user?.id ?? null);
        }
      }
      const draft = await generateSalesFollowUpDraft(candidate.id, guard.user?.id ?? null, {
        allowedStages: [...allowedStages],
        minimumFollowUpDays: 3,
      });
      if (!draft.sendReady) {
        missingRequirements += 1;
        results.push({
          candidateId: candidate.id,
          candidateName: candidate.candidateName,
          status: "missing_requirements",
          missingRequirements: draft.missingRequirements,
          toEmail: draft.toEmail,
          outreachStage: draft.outreachStage,
        });
        continue;
      }

      generated += 1;
      alreadyQueued.add(candidate.id);
      if (draft.toEmail) {
        generatedRecipientEmails.add(draft.toEmail.toLowerCase());
        queuedRecipientEmails.add(draft.toEmail.toLowerCase());
      }
      results.push({
        candidateId: candidate.id,
        candidateName: candidate.candidateName,
        status: "generated",
        approvalId: draft.approvalId,
        toEmail: draft.toEmail,
        outreachStage: draft.outreachStage,
        copyVariantKey: draft.copyVariantKey,
      });
    } catch (error) {
      results.push({
        candidateId: candidate.id,
        candidateName: candidate.candidateName,
        status: "failed",
        error: error instanceof Error ? error.message : "Draft generation failed.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    mode,
    generated,
    skippedExisting,
    missingRequirements,
    leadSync,
    limit,
    results,
  });
}
