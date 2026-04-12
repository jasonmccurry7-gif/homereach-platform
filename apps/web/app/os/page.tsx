import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  db,
  spotAssignments,
  intakeSubmissions,
  businesses,
  marketingCampaigns,
  waitlistEntries,
  outreachReplies,
} from "@homereach/db";
import { eq, count, sum } from "drizzle-orm";
import { OSClient } from "./os-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "HomeReach OS — Operator Control Center",
  description: "Unified operator control center for HomeReach",
};

// ─────────────────────────────────────────────────────────────────────────────
// /os — Primary Operator Control Center
//
// This is the ONLY page the platform operator needs.
// All internal systems + external links reachable in one click.
// Protected: admin only (same check as admin layout).
// ─────────────────────────────────────────────────────────────────────────────

export default async function OSPage() {
  // ── Auth gate ──────────────────────────────────────────────────────────────
  const devBypass = process.env.ADMIN_DEV_BYPASS === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (devBypass && isProduction) {
    throw new Error(
      "SECURITY VIOLATION: ADMIN_DEV_BYPASS=true in production. Remove immediately."
    );
  }

  if (!devBypass) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const role = user.app_metadata?.user_role as string;
    if (role !== "admin") redirect("/dashboard");
  }

  // ── Live stats (parallel queries) ─────────────────────────────────────────
  const [
    activeSpotsResult,
    pendingSpotsResult,
    mrrResult,
    pendingIntakeResult,
    activeClientsResult,
    activeCampaignsResult,
    unreadRepliesResult,
    waitlistResult,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(spotAssignments)
      .where(eq(spotAssignments.status, "active"))
      .catch(() => [{ n: 0 }]),

    db
      .select({ n: count() })
      .from(spotAssignments)
      .where(eq(spotAssignments.status, "pending"))
      .catch(() => [{ n: 0 }]),

    db
      .select({ total: sum(spotAssignments.monthlyValueCents) })
      .from(spotAssignments)
      .where(eq(spotAssignments.status, "active"))
      .catch(() => [{ total: null }]),

    db
      .select({ n: count() })
      .from(intakeSubmissions)
      .where(eq(intakeSubmissions.status, "submitted"))
      .catch(() => [{ n: 0 }]),

    db
      .select({ n: count() })
      .from(businesses)
      .where(eq(businesses.status, "active"))
      .catch(() => [{ n: 0 }]),

    db
      .select({ n: count() })
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.status, "active"))
      .catch(() => [{ n: 0 }]),

    db
      .select({ n: count() })
      .from(outreachReplies)
      .where(eq(outreachReplies.status, "pending"))
      .catch(() => [{ n: 0 }]),

    db
      .select({ n: count() })
      .from(waitlistEntries)
      .catch(() => [{ n: 0 }]),
  ]);

  const stats = {
    activeSpots: Number(activeSpotsResult[0]?.n ?? 0),
    pendingSpots: Number(pendingSpotsResult[0]?.n ?? 0),
    mrr: Math.round(Number(mrrResult[0]?.total ?? 0) / 100),
    pendingIntake: Number(pendingIntakeResult[0]?.n ?? 0),
    activeClients: Number(activeClientsResult[0]?.n ?? 0),
    activeCampaigns: Number(activeCampaignsResult[0]?.n ?? 0),
    unreadReplies: Number(unreadRepliesResult[0]?.n ?? 0),
    waitlist: Number(waitlistResult[0]?.n ?? 0),
  };

  return <OSClient stats={stats} />;
}
