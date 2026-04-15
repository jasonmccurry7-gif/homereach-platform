import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import { FoundingClient } from "./founding-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Founding Members — HomeReach Admin" };

interface FoundingSlot {
  id: string;
  city: string;
  category: string | null;
  product: string;
  tier: string;
  total_slots: number;
  slots_taken: number;
  slots_remaining: number;
  founding_open: boolean;
  standard_price_cents: number;
  founding_price_cents: number;
  created_at: string;
  updated_at: string;
}

interface FoundingMembership {
  id: string;
  business_name: string;
  city: string;
  category: string | null;
  product: string;
  tier: string;
  locked_price_cents: number;
  standard_price_cents: number;
  stripe_subscription_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default async function AdminFoundingPage() {
  const db = createServiceClient();

  // Fetch all founding slots
  const { data: slots = [] } = await db
    .from("founding_slots")
    .select("*")
    .order("city", { ascending: true })
    .order("tier", { ascending: true });

  // Fetch all founding memberships
  const { data: memberships = [] } = await db
    .from("founding_memberships")
    .select("*")
    .order("created_at", { ascending: false });

  // Calculate stats
  const totalMembers = memberships.length;
  const totalLockedRevenue = (memberships as FoundingMembership[]).reduce(
    (sum, m) => sum + (m.locked_price_cents || 0),
    0
  );
  const totalSlotsRemaining = (slots as FoundingSlot[]).reduce(
    (sum, s) => sum + (s.slots_remaining || 0),
    0
  );
  const revenueAtRisk = (memberships as FoundingMembership[]).reduce(
    (sum, m) => sum + ((m.standard_price_cents || 0) - (m.locked_price_cents || 0)),
    0
  );

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Founding Members</h1>
        <p className="mt-2 text-sm text-gray-500">
          Manage founding slot availability and track founding member commitments
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-600">Total Members</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalMembers}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-600">Monthly Locked Revenue</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            ${(totalLockedRevenue / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-600">Slots Remaining</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalSlotsRemaining}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-600">Revenue at Risk</p>
          <p className="text-2xl font-bold text-red-600 mt-2">
            ${(revenueAtRisk / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <FoundingClient
        initialSlots={slots as FoundingSlot[]}
        initialMemberships={memberships as FoundingMembership[]}
      />
    </div>
  );
}
