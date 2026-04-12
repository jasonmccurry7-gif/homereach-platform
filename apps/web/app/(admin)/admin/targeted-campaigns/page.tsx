import type { Metadata } from "next";
import { db, leads, targetedRouteCampaigns } from "@homereach/db";
import { desc } from "drizzle-orm";
import { TargetedCampaignsClient } from "./targeted-campaigns-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Targeted Campaigns — HomeReach Admin" };

export default async function TargetedCampaignsPage() {
  const [allLeads, allCampaigns] = await Promise.all([
    db.select().from(leads).orderBy(desc(leads.createdAt)).limit(200),
    db.select().from(targetedRouteCampaigns).orderBy(desc(targetedRouteCampaigns.createdAt)).limit(200),
  ]);

  return (
    <TargetedCampaignsClient
      leads={allLeads.map((l) => ({
        id:                l.id,
        name:              l.name,
        businessName:      l.businessName,
        phone:             l.phone,
        email:             l.email,
        source:            l.source,
        status:            l.status,
        city:              l.city,
        notes:             l.notes,
        intakeToken:       l.intakeToken,
        intakeSentAt:      l.intakeSentAt?.toISOString() ?? null,
        intakeSubmittedAt: l.intakeSubmittedAt?.toISOString() ?? null,
        paidAt:            l.paidAt?.toISOString() ?? null,
        mailedAt:          l.mailedAt?.toISOString() ?? null,
        reviewRequested:   l.reviewRequested,
        createdAt:         l.createdAt.toISOString(),
      }))}
      campaigns={allCampaigns.map((c) => ({
        id:               c.id,
        leadId:           c.leadId,
        businessName:     c.businessName,
        contactName:      c.contactName,
        email:            c.email,
        phone:            c.phone,
        businessAddress:  c.businessAddress,
        targetCity:       c.targetCity,
        targetAreaNotes:  c.targetAreaNotes,
        homesCount:       c.homesCount,
        priceCents:       c.priceCents,
        status:           c.status,
        designStatus:     c.designStatus,
        mailingStatus:    c.mailingStatus,
        reviewRequested:  c.reviewRequested,
        notes:            c.notes,
        createdAt:        c.createdAt.toISOString(),
      }))}
    />
  );
}
