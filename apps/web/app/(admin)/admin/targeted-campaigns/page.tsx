import type { Metadata } from "next";
import { db, leads, targetedRouteCampaigns } from "@homereach/db";
import { desc } from "drizzle-orm";
import { TargetedCampaignsClient } from "./targeted-campaigns-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Targeted Campaigns - HomeReach Admin" };

export default async function TargetedCampaignsPage() {
  const [allLeads, allCampaigns] = await Promise.all([
    db.select().from(leads).orderBy(desc(leads.createdAt)).limit(200),
    db.select().from(targetedRouteCampaigns).orderBy(desc(targetedRouteCampaigns.createdAt)).limit(200),
  ]);

  return (
    <TargetedCampaignsClient
      leads={allLeads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        businessName: lead.businessName,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        status: lead.status,
        city: lead.city,
        notes: lead.notes,
        intakeToken: lead.intakeToken,
        intakeSentAt: lead.intakeSentAt?.toISOString() ?? null,
        intakeSubmittedAt: lead.intakeSubmittedAt?.toISOString() ?? null,
        paidAt: lead.paidAt?.toISOString() ?? null,
        mailedAt: lead.mailedAt?.toISOString() ?? null,
        reviewRequested: lead.reviewRequested,
        createdAt: lead.createdAt.toISOString(),
      }))}
      campaigns={allCampaigns.map((campaign) => ({
        id: campaign.id,
        leadId: campaign.leadId,
        businessName: campaign.businessName,
        contactName: campaign.contactName,
        email: campaign.email,
        phone: campaign.phone,
        businessAddress: campaign.businessAddress,
        targetCity: campaign.targetCity,
        targetAreaNotes: campaign.targetAreaNotes,
        homesCount: campaign.homesCount,
        priceCents: campaign.priceCents,
        status: campaign.status,
        designStatus: campaign.designStatus,
        mailingStatus: campaign.mailingStatus,
        reviewRequested: campaign.reviewRequested,
        notes: campaign.notes,
        createdAt: campaign.createdAt.toISOString(),
      }))}
    />
  );
}
