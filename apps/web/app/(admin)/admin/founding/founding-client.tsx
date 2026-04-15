"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Check, AlertCircle } from "lucide-react";

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

interface FoundingClientProps {
  initialSlots: FoundingSlot[];
  initialMemberships: FoundingMembership[];
}

export function FoundingClient({ initialSlots, initialMemberships }: FoundingClientProps) {
  const [slots, setSlots] = useState<FoundingSlot[]>(initialSlots);
  const [memberships, setMemberships] = useState<FoundingMembership[]>(initialMemberships);
  const [filterCity, setFilterCity] = useState<string>("");
  const [filterProduct, setFilterProduct] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get unique cities and products for filters
  const cities = Array.from(new Set(slots.map((s) => s.city))).sort();
  const products = Array.from(new Set(slots.map((s) => s.product))).sort();

  // Filter memberships
  const filteredMemberships = memberships.filter((m) => {
    if (filterCity && m.city !== filterCity) return false;
    if (filterProduct && m.product !== filterProduct) return false;
    if (filterStatus && m.status !== filterStatus) return false;
    return true;
  });

  const handleToggleFounding = async (slotId: string, currentValue: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/founding/slots", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: slotId,
          founding_open: !currentValue,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update founding slot");
      }

      const updated = await response.json();
      setSlots(slots.map((s) => (s.id === slotId ? updated : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Founding Slot Manager */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Founding Slot Manager</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">City</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Product</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Tier</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Slots</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Founding Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {slots.map((slot) => (
                <tr key={slot.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 font-medium text-gray-900">{slot.city}</td>
                  <td className="px-4 py-4 text-gray-700">{slot.product}</td>
                  <td className="px-4 py-4 text-gray-700">{slot.tier}</td>
                  <td className="px-4 py-4 text-right text-gray-700">
                    <span className="font-mono font-semibold">
                      {slot.slots_taken}/{slot.total_slots}
                    </span>
                    <span className="text-gray-500 ml-2">
                      ({slot.slots_remaining} remaining)
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {slot.slots_remaining === 0 ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Sold Out
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                        <Check className="w-3 h-3 mr-1" />
                        Available
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => handleToggleFounding(slot.id, slot.founding_open)}
                      disabled={loading}
                      className={`px-3 py-1.5 rounded-md font-medium text-sm transition-colors ${
                        slot.founding_open
                          ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      } disabled:opacity-50`}
                    >
                      {slot.founding_open ? "ON" : "OFF"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Founding Members */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Founding Members</h2>
          <div className="flex gap-3">
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700"
            >
              <option value="">All Cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <select
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700"
            >
              <option value="">All Products</option>
              {products.map((product) => (
                <option key={product} value={product}>
                  {product}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </div>

        {filteredMemberships.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-500">No founding members match the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">Business Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">City</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Category</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Product</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Tier</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Locked Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Standard Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Savings/Month</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Subscription ID</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredMemberships.map((member) => {
                  const savingsPerMonth = (member.standard_price_cents - member.locked_price_cents) / 100;
                  return (
                    <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 font-medium text-gray-900">
                        {member.business_name}
                      </td>
                      <td className="px-4 py-4 text-gray-700">{member.city}</td>
                      <td className="px-4 py-4 text-gray-700">
                        {member.category || "—"}
                      </td>
                      <td className="px-4 py-4 text-gray-700">{member.product}</td>
                      <td className="px-4 py-4 text-gray-700">{member.tier}</td>
                      <td className="px-4 py-4 text-right font-mono font-semibold text-blue-600">
                        ${(member.locked_price_cents / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-gray-500 line-through">
                        ${(member.standard_price_cents / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-green-600">
                        Customer saves ${savingsPerMonth.toFixed(2)}/mo
                      </td>
                      <td className="px-4 py-4 text-xs font-mono text-gray-500">
                        {member.stripe_subscription_id
                          ? member.stripe_subscription_id.substring(0, 20) + "..."
                          : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                            member.status === "active"
                              ? "bg-green-50 border-green-200 text-green-700"
                              : member.status === "cancelled"
                              ? "bg-red-50 border-red-200 text-red-700"
                              : "bg-gray-100 border-gray-200 text-gray-700"
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
}
