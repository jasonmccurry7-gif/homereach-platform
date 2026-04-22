// ─────────────────────────────────────────────────────────────────────────────
// HomeReach SEO Engine - Quality Check Wrapper
//
// Thin TS wrapper around the PL/pgSQL function seo_pages_quality_check
// created in migration 059. Called by the admin API check endpoint and
// again at publish time as a second gate.
//
// Also provides CTA URL HEAD-check helpers which cannot run in SQL.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/service";
import { isSeoEngineEnabled } from "./env";

export type QualityCheckResult = {
  passed: boolean;
  issues: string[];
  checked_at: string;
};

/** Runs the DB-side quality check and returns the stored result. */
export async function runQualityCheck(pageId: string): Promise<QualityCheckResult> {
  if (!isSeoEngineEnabled()) {
    return { passed: false, issues: ["flag_off"], checked_at: new Date().toISOString() };
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("seo_pages_quality_check", { p_page_id: pageId });
  if (error || !data) {
    return { passed: false, issues: [error?.message ?? "rpc_failed"], checked_at: new Date().toISOString() };
  }
  return data as QualityCheckResult;
}

/** HEAD-checks a relative funnel URL against the current deployment. */
export async function ctaUrlResolves(relativeUrl: string): Promise<{ ok: boolean; status: number }> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com";
  const fullUrl = relativeUrl.startsWith("http") ? relativeUrl : `${base}${relativeUrl}`;
  try {
    const res = await fetch(fullUrl, { method: "HEAD", redirect: "follow" });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Combines DB check + CTA HEAD check. Returned union of issues. */
export async function runFullQualityCheck(pageId: string, primaryCtaUrl: string | null): Promise<QualityCheckResult> {
  const dbResult = await runQualityCheck(pageId);
  const issues = [...dbResult.issues];

  if (primaryCtaUrl && primaryCtaUrl.startsWith("/")) {
    const headRes = await ctaUrlResolves(primaryCtaUrl);
    if (!headRes.ok) {
      issues.push(`primary_cta_url_unreachable:${headRes.status || "network_error"}`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    checked_at: new Date().toISOString(),
  };
}
