// ─────────────────────────────────────────────────────────────────────────────
// Mock Migrated Clients (Legacy / Existing Customers)
// Replace with Supabase query when DB is connected.
// ─────────────────────────────────────────────────────────────────────────────

import type { MigratedClient } from "@/lib/engine/types";

function contractFrom(startISO: string, durationMonths: number): MigratedClient["contract"] {
  const start = new Date(startISO);
  const end   = new Date(startISO);
  end.setMonth(end.getMonth() + durationMonths);

  const now = new Date();
  const msRemaining = end.getTime() - now.getTime();
  const remainingMonths = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24 * 30)));
  const daysRemaining   = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const isNearingRenewal = daysRemaining <= 60;

  return {
    startDate:       start.toISOString().split("T")[0],
    endDate:         end.toISOString().split("T")[0],
    remainingMonths,
    isNearingRenewal,
    renewalTriggered: isNearingRenewal && remainingMonths <= 1,
    renewalNote: isNearingRenewal ? "Renewal conversation should be initiated" : undefined,
  };
}

export const MOCK_MIGRATED_CLIENTS: MigratedClient[] = [
  {
    id: "mc-1",
    businessName: "Townsend HVAC",
    contactName: "Derek Townsend",
    phone: "+13303043333",
    email: "derek@townsend-hvac.com",
    cityId: "city-medina",
    city: "Medina, OH",
    categoryId: "cat-hvac",
    category: "HVAC",
    spotId: "spot-med-hvac",
    spotType: "front",
    monthlyPrice: 275,
    migrationStatus: "legacy_active",
    contract: contractFrom("2025-10-01", 12),
    notes: "Original customer from first Medina campaign. Verbal agreement, no digital contract. Renews October 2026.",
    migratedAt: "2026-04-01T10:00:00Z",
    migratedBy: "Jason",
    appearsInDashboard: true,
    appearsInROI: true,
    billingPrevented: true,
  },
  {
    id: "mc-2",
    businessName: "Frost Realty",
    contactName: "Angela Frost",
    phone: "+13303048888",
    email: "angela@frostrealty.com",
    cityId: "city-hudson",
    city: "Hudson, OH",
    categoryId: "cat-realtor",
    category: "Realtor",
    spotId: "spot-hud-realtor",
    spotType: "anchor",
    monthlyPrice: 399,
    migrationStatus: "legacy_active",
    contract: contractFrom("2025-08-01", 12),
    notes: "On a custom anchor spot deal. Contract runs through July 2026. Nearing renewal — has expressed interest in upgrading to full card.",
    migratedAt: "2026-04-02T09:30:00Z",
    migratedBy: "Jason",
    appearsInDashboard: true,
    appearsInROI: true,
    billingPrevented: true,
  },
  {
    id: "mc-3",
    businessName: "Vega Dental",
    contactName: "Sandra Vega",
    phone: "+13303042222",
    email: "sandra@vegadental.com",
    cityId: "city-stow",
    city: "Stow, OH",
    categoryId: "cat-dental",
    category: "Dentist",
    spotId: "spot-stow-dental",
    spotType: "back",
    monthlyPrice: 249,
    migrationStatus: "new_system",
    contract: contractFrom("2026-01-01", 12),
    notes: "Transitioned from legacy to new digital contract in Jan 2026. On new billing system.",
    migratedAt: "2026-01-05T11:00:00Z",
    migratedBy: "Jason",
    appearsInDashboard: true,
    appearsInROI: true,
    billingPrevented: false,
  },
  {
    id: "mc-4",
    businessName: "Mendes Landscaping",
    contactName: "Carlos Mendes",
    phone: "+13303045555",
    email: "carlos@mendeslandscaping.com",
    cityId: "city-medina",
    city: "Medina, OH",
    categoryId: "cat-landscape",
    category: "Landscaper",
    spotId: "spot-med-landscape",
    spotType: "front",
    monthlyPrice: 299,
    migrationStatus: "legacy_active",
    contract: contractFrom("2025-12-01", 12),
    notes: "Referred by Mike Harrington. Paid upfront for 6 months, then monthly. Mid-term renewal window opens June 2026.",
    migratedAt: "2026-04-03T14:00:00Z",
    migratedBy: "Jason",
    appearsInDashboard: true,
    appearsInROI: true,
    billingPrevented: true,
  },
  {
    id: "mc-5",
    businessName: "Hudson Family Chiropractic",
    contactName: "Dr. Priya Nair",
    phone: "+13303044444",
    email: "priya@nairchiro.com",
    cityId: "city-hudson",
    city: "Hudson, OH",
    categoryId: "cat-chiro",
    category: "Chiropractor",
    spotId: null,
    spotType: "front",
    monthlyPrice: 299,
    migrationStatus: "legacy_pending",
    contract: contractFrom("2026-05-01", 12),
    notes: "Contract starts May 2026. Intake form submitted but spot assignment pending. Do not bill until spot confirmed.",
    migratedAt: "2026-04-07T16:00:00Z",
    migratedBy: "Ryan Cole",
    appearsInDashboard: false,
    appearsInROI: false,
    billingPrevented: true,
  },
];

/** Status metadata for UI display */
export const MIGRATION_STATUS_META: Record<
  MigratedClient["migrationStatus"],
  { label: string; color: string; description: string }
> = {
  legacy_active:  { label: "Legacy Active",  color: "bg-amber-100 text-amber-800",  description: "Existing paid customer — billing prevented, manual contract" },
  legacy_pending: { label: "Legacy Pending", color: "bg-blue-100 text-blue-700",    description: "Migration in progress — spot or contract not yet finalized" },
  new_system:     { label: "New System",     color: "bg-green-100 text-green-800",   description: "Fully transitioned to digital contract and billing" },
};

export const SPOT_TYPE_META: Record<
  MigratedClient["spotType"],
  { label: string; description: string }
> = {
  front:     { label: "Front",     description: "Premium front-of-card placement" },
  back:      { label: "Back",      description: "Back-of-card placement" },
  anchor:    { label: "Anchor",    description: "Large anchor spot — center feature" },
  full_card: { label: "Full Card", description: "Full postcard ownership — all spots" },
};
