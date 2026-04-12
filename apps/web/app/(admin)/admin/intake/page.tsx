import type { Metadata } from "next";
import {
  db, intakeSubmissions, businesses, spotAssignments, cities, categories,
} from "@homereach/db";
import { desc, eq } from "drizzle-orm";
import { IntakeQueueClient } from "./intake-queue-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Intake Queue — HomeReach Admin" };

// ─────────────────────────────────────────────────────────────────────────────
// Agent 2 — Fulfillment & Ops + Agent 7 — Targeted Campaign
// /admin/intake — Review submitted intake forms, action campaign creation
// ─────────────────────────────────────────────────────────────────────────────

export default async function AdminIntakePage() {
  const rows = await db
    .select({
      id:               intakeSubmissions.id,
      status:           intakeSubmissions.status,
      accessToken:      intakeSubmissions.accessToken,
      serviceArea:      intakeSubmissions.serviceArea,
      targetCustomer:   intakeSubmissions.targetCustomer,
      keyOffer:         intakeSubmissions.keyOffer,
      differentiators:  intakeSubmissions.differentiators,
      additionalNotes:  intakeSubmissions.additionalNotes,
      submittedAt:      intakeSubmissions.submittedAt,
      createdAt:        intakeSubmissions.createdAt,
      businessName:     businesses.name,
      businessEmail:    businesses.email,
      businessPhone:    businesses.phone,
      spotType:         spotAssignments.spotType,
      cityName:         cities.name,
      cityState:        cities.state,
      categoryName:     categories.name,
    })
    .from(intakeSubmissions)
    .leftJoin(businesses,     eq(intakeSubmissions.businessId,       businesses.id))
    .leftJoin(spotAssignments, eq(intakeSubmissions.spotAssignmentId, spotAssignments.id))
    .leftJoin(cities,         eq(spotAssignments.cityId,             cities.id))
    .leftJoin(categories,     eq(spotAssignments.categoryId,         categories.id))
    .orderBy(desc(intakeSubmissions.submittedAt))
    .limit(200);

  const items = rows.map((r) => ({
    id:              r.id,
    status:          r.status,
    accessToken:     r.accessToken,
    serviceArea:     r.serviceArea ?? "",
    targetCustomer:  r.targetCustomer ?? "",
    keyOffer:        r.keyOffer ?? "",
    differentiators: r.differentiators ?? "",
    additionalNotes: r.additionalNotes ?? "",
    submittedAt:     r.submittedAt instanceof Date ? r.submittedAt.toISOString() : (r.submittedAt ?? null),
    createdAt:       r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    businessName:    r.businessName ?? "—",
    businessEmail:   r.businessEmail ?? "—",
    businessPhone:   r.businessPhone ?? "—",
    spotType:        r.spotType ?? "—",
    market:          r.cityName && r.cityState ? `${r.cityName}, ${r.cityState}` : "—",
    category:        r.categoryName ?? "—",
  }));

  const pending   = items.filter((i) => i.status === "pending").length;
  const submitted = items.filter((i) => i.status === "submitted").length;
  const reviewed  = items.filter((i) => i.status === "reviewed").length;

  return (
    <IntakeQueueClient
      items={items}
      stats={{ pending, submitted, reviewed }}
    />
  );
}
