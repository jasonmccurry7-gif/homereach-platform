"use client";

import { useState } from "react";

interface Bundle {
  id: string;
  name: string;
  slug: string;
  standard_price: number | null;
  founding_price: number | null;
  price: number;
}

interface City {
  id: string;
  name: string;
  state: string;
  founding_eligible: boolean;
  is_active: boolean;
}

interface PricingClientProps {
  bundles: Bundle[];
  cities: City[];
}

export default function PricingClient({ bundles, cities }: PricingClientProps) {
  const [bundleEdits, setBundleEdits] = useState<Record<string, { standardPrice: string; foundingPrice: string }>>({});
  const [bundleLoading, setBundleLoading] = useState<Record<string, boolean>>({});
  const [cityLoading, setCityLoading] = useState<Record<string, boolean>>({});
  const [confirmDialog, setConfirmDialog] = useState<{ cityId: string; cityName: string } | null>(null);

  const handleBundleChange = (bundleId: string, field: 'standardPrice' | 'foundingPrice', value: string) => {
    setBundleEdits(prev => ({
      ...prev,
      [bundleId]: {
        ...prev[bundleId],
        [field]: value,
      },
    }));
  };

  const saveBundlePrice = async (bundleId: string, bundleName: string) => {
    const edits = bundleEdits[bundleId];
    if (!edits) return;

    const standardPrice = parseFloat(edits.standardPrice);
    const foundingPrice = parseFloat(edits.foundingPrice);

    if (isNaN(standardPrice) || isNaN(foundingPrice)) {
      alert('Please enter valid prices');
      return;
    }

    setBundleLoading(prev => ({ ...prev, [bundleId]: true }));
    try {
      const res = await fetch('/api/admin/pricing/bundle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId, standardPrice, foundingPrice }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`Error: ${data.error}`);
        return;
      }

      // Clear edits on success
      setBundleEdits(prev => {
        const next = { ...prev };
        delete next[bundleId];
        return next;
      });
      alert(`${bundleName} pricing updated`);
    } catch (err) {
      alert(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBundleLoading(prev => ({ ...prev, [bundleId]: false }));
    }
  };

  const toggleCityFounding = (cityId: string, cityName: string, currentStatus: boolean) => {
    if (currentStatus) {
      // Closing founding — show confirm dialog
      setConfirmDialog({ cityId, cityName });
    } else {
      // Opening founding — no confirmation needed
      updateCityFounding(cityId, cityName, true);
    }
  };

  const updateCityFounding = async (cityId: string, cityName: string, foundingEligible: boolean) => {
    setCityLoading(prev => ({ ...prev, [cityId]: true }));
    try {
      const res = await fetch('/api/admin/pricing/city', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityId, foundingEligible }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`Error: ${data.error}`);
        return;
      }

      // Refresh page or update state
      window.location.reload();
    } catch (err) {
      alert(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCityLoading(prev => ({ ...prev, [cityId]: false }));
      setConfirmDialog(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Pricing Management</h1>

      {/* Section 1: Spot Pricing Table */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Spot Pricing</h2>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Spot</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Standard Price</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Founding Price</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Customer Saves</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((bundle) => {
                const edits = bundleEdits[bundle.id];
                const standardPrice = edits ? parseFloat(edits.standardPrice) : (bundle.standard_price ?? 0) / 100;
                const foundingPrice = edits ? parseFloat(edits.foundingPrice) : (bundle.founding_price ?? 0) / 100;
                const savings = standardPrice - foundingPrice;
                const savingsPercent = standardPrice > 0 ? Math.round((savings / standardPrice) * 100) : 0;

                return (
                  <tr key={bundle.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{bundle.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={edits?.standardPrice ?? (bundle.standard_price ?? 0) / 100}
                          onChange={(e) => handleBundleChange(bundle.id, 'standardPrice', e.target.value)}
                          className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">/mo</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={edits?.foundingPrice ?? (bundle.founding_price ?? 0) / 100}
                          onChange={(e) => handleBundleChange(bundle.id, 'foundingPrice', e.target.value)}
                          className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">/mo</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="font-medium text-green-700">${savings.toFixed(2)}/mo</p>
                        <p className="text-xs text-gray-500">{savingsPercent}% savings</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => saveBundlePrice(bundle.id, bundle.name)}
                        disabled={!edits || bundleLoading[bundle.id]}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        {bundleLoading[bundle.id] ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: City Founding Status */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-gray-900 mb-6">City Founding Status</h2>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">City</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Status</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cities.map((city) => (
                <tr key={city.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{city.name}</p>
                    <p className="text-xs text-gray-500">{city.state}</p>
                  </td>
                  <td className="px-6 py-4">
                    {city.founding_eligible ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
                        Founding Open
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                        <span className="inline-block w-2 h-2 bg-gray-500 rounded-full" />
                        City Full — Standard Pricing
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleCityFounding(city.id, city.name, city.founding_eligible)}
                      disabled={cityLoading[city.id]}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                        city.founding_eligible
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {cityLoading[city.id]
                        ? 'Updating...'
                        : city.founding_eligible
                          ? 'Close Founding'
                          : 'Reopen Founding'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Info Box */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 px-6 py-4">
        <p className="text-sm font-medium text-gray-900">Pricing Lock Policy</p>
        <p className="mt-2 text-sm text-gray-600">
          Existing customers are never affected. Their locked_price is permanent and used for all Stripe renewals. Only new customers pay the updated pricing.
        </p>
      </div>

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Close Founding for {confirmDialog.cityName}?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Switch {confirmDialog.cityName} to standard pricing? New customers will pay $300–$900/mo instead of founding rates. Existing customers are not affected.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => updateCityFounding(confirmDialog.cityId, confirmDialog.cityName, false)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Close Founding
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
