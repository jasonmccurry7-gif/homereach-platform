"use client";

import { useState } from "react";
import type { CityAvailability, Reservation, SpotStatus } from "@/lib/engine/types";
import { AvailabilityEngine } from "@/lib/engine/availability";
import { ReservationEngine } from "@/lib/engine/reservation";

const STATUS_STYLES: Record<SpotStatus, { dot: string; badge: string; label: string }> = {
  available:    { dot: "bg-green-500",  badge: "bg-green-50 text-green-700 border-green-200",   label: "Available" },
  reserved:     { dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-700 border-amber-200",   label: "Reserved" },
  "in-progress":{ dot: "bg-blue-500",   badge: "bg-blue-50 text-blue-700 border-blue-200",      label: "In Progress" },
  sold:         { dot: "bg-red-400",    badge: "bg-red-50 text-red-700 border-red-200",          label: "Sold" },
};

const URGENCY_COLORS: Record<string, string> = {
  low:      "bg-green-500",
  medium:   "bg-yellow-400",
  high:     "bg-orange-500",
  critical: "bg-red-500",
};

function SpotRow({ spot, reservation }: {
  spot: CityAvailability["spots"][number];
  reservation?: Reservation;
}) {
  const style = STATUS_STYLES[spot.status];
  const hoursLeft = reservation ? ReservationEngine.hoursRemaining(reservation) : null;

  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
        <span className="font-medium text-sm text-gray-900">{spot.categoryName}</span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        {spot.businessName && (
          <span className="text-gray-500 truncate max-w-[160px]">{spot.businessName}</span>
        )}
        {hoursLeft !== null && (
          <span className="text-orange-600 font-medium">⏱ {hoursLeft}h left</span>
        )}
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${style.badge}`}>
          {style.label}
        </span>
      </div>
    </div>
  );
}

function CityCard({ city, reservations }: {
  city: CityAvailability;
  reservations: Reservation[];
}) {
  const [expanded, setExpanded] = useState(false);
  const urgencyMsg = AvailabilityEngine.getUrgencyMessage(city.availableSpots, city.totalSpots);
  const barColor = URGENCY_COLORS[city.urgencyLevel] ?? "bg-gray-400";
  const fillPct = Math.round(((city.soldSpots + city.reservedSpots) / city.totalSpots) * 100);

  const cityReservations = reservations.filter((r) => r.cityId === city.cityId);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* City header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-gray-900">{city.cityName}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{urgencyMsg}</p>
          </div>
          <div className="text-right">
            {city.isFullCardAvailable && (
              <span className="inline-flex items-center rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold px-2.5 py-0.5 mb-1">
                Full Card Available
              </span>
            )}
            <div className="flex gap-3 text-sm">
              <span className="text-green-700 font-semibold">{city.availableSpots} open</span>
              <span className="text-amber-600 font-semibold">{city.reservedSpots} held</span>
              <span className="text-red-500 font-semibold">{city.soldSpots} sold</span>
            </div>
          </div>
        </div>

        {/* Fill rate bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Fill rate</span>
            <span className="font-medium">{fillPct}% of {city.totalSpots} spots</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Active reservations */}
      {cityReservations.length > 0 && (
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
          <p className="text-xs font-semibold text-amber-700 mb-2">⏱ Active Holds ({cityReservations.length})</p>
          {cityReservations.map((res) => (
            <div key={res.id} className="flex items-center justify-between text-xs text-amber-800 mb-1">
              <span>{res.categoryId.replace("cat-", "")} — {res.businessName}</span>
              <span className="font-medium">{ReservationEngine.countdownLabel(res)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Spot list toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 text-left text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-between"
      >
        <span>{expanded ? "Hide" : "Show"} all {city.totalSpots} spots</span>
        <span>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div>
          {city.spots.map((spot) => (
            <SpotRow
              key={spot.id}
              spot={spot}
              reservation={reservations.find((r) => r.spotId === spot.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AvailabilityClient({
  cities,
  reservations,
}: {
  cities: CityAvailability[];
  reservations: Reservation[];
}) {
  const totalSpots     = cities.reduce((s, c) => s + c.totalSpots, 0);
  const totalAvailable = cities.reduce((s, c) => s + c.availableSpots, 0);
  const totalReserved  = cities.reduce((s, c) => s + c.reservedSpots, 0);
  const totalSold      = cities.reduce((s, c) => s + c.soldSpots, 0);

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Spot Availability</h1>
        <p className="mt-1 text-sm text-gray-500">
          Real-time view of spot status across all cities
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Spots",  value: totalSpots,     color: "text-gray-900" },
          { label: "Available",    value: totalAvailable, color: "text-green-700" },
          { label: "On Hold",      value: totalReserved,  color: "text-amber-600" },
          { label: "Sold",         value: totalSold,      color: "text-red-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Active reservations panel */}
      {reservations.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900 mb-3">
            ⏱ Active Reservations ({reservations.length})
          </h2>
          <div className="space-y-2">
            {reservations.map((res) => (
              <div
                key={res.id}
                className="flex items-center justify-between rounded-xl bg-white border border-amber-100 px-4 py-3 text-sm"
              >
                <div>
                  <span className="font-semibold text-gray-900">{res.businessName}</span>
                  <span className="text-gray-500 ml-2">
                    {res.categoryId.replace("cat-", "")} · {res.cityId.replace("city-", "")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-amber-700 font-medium text-xs">
                    {ReservationEngine.countdownLabel(res)}
                  </span>
                  <span className="text-xs text-gray-400">
                    Expires {new Date(res.expiresAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-700 mt-3">
            💡 Admin override controls coming soon — use DB editor to manually release holds.
          </p>
        </div>
      )}

      {/* City cards */}
      <div className="grid gap-5 lg:grid-cols-2">
        {cities.map((city) => (
          <CityCard
            key={city.cityId}
            city={city}
            reservations={reservations.filter((r) => r.cityId === city.cityId)}
          />
        ))}
      </div>
    </div>
  );
}
