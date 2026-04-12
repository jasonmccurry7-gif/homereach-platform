import type { Metadata } from "next";
import Link from "next/link";
import {
  db,
  waitlistEntries,
  businesses,
  cities,
  categories,
  leads as targetedLeads,
  spotAssignments,
} from "@homereach/db";
import { eq, desc, count, inArray, sql } from "drizzle-orm";
import { LeadsClient } from "./leads-client";
import type { Lead } from "./types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leads — HomeReach Admin" };

export default async function AdminLeadsPage() {
  // ── Count targeted route campaign leads ───────────────────────────────────
  const targetedLeadsCountResult = await db
    .select({ count: count() })
    .from(targetedLeads);
  const newTargetedLeadsResult = await db
    .select({ count: count() })
    .from(targetedLeads)
    .where(eq(targetedLeads.status, "new"));

  const targetedTotal = Number(targetedLeadsCountResult[0]?.count ?? 0);
  const targetedNew   = Number(newTargetedLeadsResult[0]?.count ?? 0);

  // ── Waitlist entries (unconverted = active leads) ──────────────────────────
  const waitlist = await db
    .select({
      id:           waitlistEntries.id,
      email:        waitlistEntries.email,
      phone:        waitlistEntries.phone,
      name:         waitlistEntries.name,
      businessName: waitlistEntries.businessName,
      cityId:       waitlistEntries.cityId,
      categoryId:   waitlistEntries.categoryId,
      convertedAt:  waitlistEntries.convertedAt,
      createdAt:    waitlistEntries.createdAt,
    })
    .from(waitlistEntries)
    .orderBy(desc(waitlistEntries.createdAt))
    .limit(200);

  // ── Businesses (active = sold, pending = interested, churned = churned) ────
  const bizes = await db
    .select({
      id:         businesses.id,
      name:       businesses.name,
      email:      businesses.email,
      phone:      businesses.phone,
      status:     businesses.status,
      cityId:     businesses.cityId,
      categoryId: businesses.categoryId,
      createdAt:  businesses.createdAt,
    })
    .from(businesses)
    .orderBy(desc(businesses.createdAt))
    .limit(200);

  // ── Fetch city + category names for display ────────────────────────────────
  const cityRows     = await db.select({ id: cities.id,      name: cities.name      }).from(cities);
  const categoryRows = await db.select({ id: categories.id,  name: categories.name  }).from(categories);

  const cityMap:     Record<string, string> = {};
  const categoryMap: Record<string, string> = {};
  for (const c of cityRows)     cityMap[c.id]     = c.name;
  for (const c of categoryRows) categoryMap[c.id] = c.name;

  // ── Fetch real monthly values from spot_assignments ────────────────────────
  // Aggregate max active/paused spot value per business (most businesses have 1 spot)
  const spotValueRows = await db
    .select({
      businessId:        spotAssignments.businessId,
      monthlyValueCents: sql<number>`max(${spotAssignments.monthlyValueCents})`,
    })
    .from(spotAssignments)
    .where(inArray(spotAssignments.status, ["active", "paused"]))
    .groupBy(spotAssignments.businessId)
    .catch(() => [] as { businessId: string | null; monthlyValueCents: number }[]);

  const spotValueMap: Record<string, number> = {};
  for (const row of spotValueRows) {
    if (row.businessId) {
      spotValueMap[row.businessId] = Math.round(row.monthlyValueCents / 100);
    }
  }

  // ── Build unified lead list ────────────────────────────────────────────────
  const leads: Lead[] = [];

  // Unconverted waitlist entries → status: "lead"
  for (const w of waitlist) {
    if (w.convertedAt) continue; // already converted to business — skip
    leads.push({
      id:           `wl-${w.id}`,
      name:         w.name ?? w.email ?? "",
      businessName: w.businessName ?? w.email ?? "",
      phone:        w.phone ?? "",
      email:        w.email ?? "",
      city:         w.cityId ? (cityMap[w.cityId] ?? "Unknown") : "Unknown",
      category:     w.categoryId ? (categoryMap[w.categoryId] ?? "Unknown") : "Unknown",
      status:       "lead",
      source:       "waitlist",
      lastContact:  w.createdAt instanceof Date ? w.createdAt.toISOString() : new Date().toISOString(),
      notes:        "",
      spotId:       null,
      monthlyValue: 0,
    });
  }

  // Businesses → map status
  const statusMap: Record<string, Lead["status"]> = {
    pending: "interested",
    active:  "sold",
    paused:  "interested",
    churned: "churned",
  };

  for (const b of bizes) {
    const mappedStatus = statusMap[b.status] ?? "lead";
    leads.push({
      id:           `biz-${b.id}`,
      name:         b.name ?? "",
      businessName: b.name ?? "",
      phone:        b.phone ?? "",
      email:        b.email ?? "",
      city:         b.cityId ? (cityMap[b.cityId] ?? "Unknown") : "Unknown",
      category:     b.categoryId ? (categoryMap[b.categoryId] ?? "Unknown") : "Unknown",
      status:       mappedStatus,
      source:       "inbound",
      lastContact:  b.createdAt instanceof Date ? b.createdAt.toISOString() : new Date().toISOString(),
      notes:        "",
      spotId:       null,
      monthlyValue: spotValueMap[b.id] ?? 0,
    });
  }

  return (
    <>
      {/* ── Targeted Route Campaign leads banner ───────────────────────── */}
      {targetedTotal > 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-6">
          <Link
            href="/admin/targeted-campaigns"
            className="flex items-center justify-between rounded-2xl bg-blue-600 px-5 py-4 text-white hover:bg-blue-700 transition"
          >
            <div>
              <p className="font-bold text-sm">📬 Targeted Route Campaign Leads</p>
              <p className="text-blue-200 text-xs mt-0.5">
                {targetedTotal} total leads
                {targetedNew > 0 && (
                  <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                    {targetedNew} new
                  </span>
                )}
              </p>
            </div>
            <span className="text-xl">→</span>
          </Link>
        </div>
      )}
      <LeadsClient initialLeads={leads} />
    </>
  );
}
