"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_PRICE_PER_PIECE_CENTS,
  capPoliticalPostcardPriceCents,
} from "@/lib/political/pricing-config";

// ─────────────────────────────────────────────────────────────────────────────
// Public planner — Instant Quote calculator (client-side preview only)
//
// Mirrors the SAFE / public-facing portion of lib/political/quote.ts so a
// visitor to /political/plan can see live cost ranges as they tweak inputs.
//
// IMPORTANT — what this component does NOT do:
//   • It does not call lib/political/quote.ts directly because that module
//     pulls in Drizzle types intended for server use.
//   • It does not surface internal cost or margin (those are server-only
//     fields in the real engine and must never reach the browser).
//   • It does not write anything to the DB; it's a calculator overlay only.
//
// The real, authoritative quote is generated server-side after the lead is
// captured (Phase 3 Decision Engine). This is purely a confidence-builder
// and "see costs instantly" UX promise on the marketing path.
//
// Pricing constants here are intentionally a SUBSET of the real engine's
// defaults (DEFAULT_PRICE_PER_PIECE_CENTS in lib/political/pricing-config.ts).
// They're kept in sync via a TODO note — when pricing changes, both must
// be edited. We use the lowest band per district type for a conservative
// "starts at" range so the public preview is always achievable.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  defaultDistrictType?: "federal" | "state" | "local";
  defaultHouseholds?: number;
  defaultDrops?: number;
}

const PRICE_PER_PIECE_CENTS = {
  local: capPoliticalPostcardPriceCents(DEFAULT_PRICE_PER_PIECE_CENTS.local["50000_plus"]),
  state: capPoliticalPostcardPriceCents(DEFAULT_PRICE_PER_PIECE_CENTS.state["50000_plus"]),
  federal: capPoliticalPostcardPriceCents(DEFAULT_PRICE_PER_PIECE_CENTS.federal["50000_plus"]),
} as const;

const SETUP_FEE_CENTS  = 25_000; // $250
const DESIGN_FEE_CENTS = 25_000; // $250

function fmtUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function InstantQuote({
  defaultDistrictType = "local",
  defaultHouseholds = 5_000,
  defaultDrops = 1,
}: Props) {
  const [districtType, setDistrictType] = useState<"federal" | "state" | "local">(
    defaultDistrictType,
  );
  const [households, setHouseholds] = useState<number>(defaultHouseholds);
  const [drops, setDrops] = useState<number>(defaultDrops);
  const [includeSetup, setIncludeSetup] = useState(true);
  const [includeDesign, setIncludeDesign] = useState(true);

  const result = useMemo(() => {
    const h = Math.max(0, Math.floor(households));
    const d = Math.min(5, Math.max(1, Math.floor(drops)));
    const totalPieces = h * d;
    const pieceCents = PRICE_PER_PIECE_CENTS[districtType];
    const subtotal = totalPieces * pieceCents;
    const addOns = (includeSetup ? SETUP_FEE_CENTS : 0) + (includeDesign ? DESIGN_FEE_CENTS : 0);
    const total = subtotal + addOns;
    return { totalPieces, pieceCents, subtotal, addOns, total, drops: d, households: h };
  }, [districtType, households, drops, includeSetup, includeDesign]);

  return (
    <aside
      aria-label="Instant cost estimate"
      className="sticky top-24 space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-5 backdrop-blur"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
          Instant estimate
        </p>
        <p className="mt-1 text-xs text-gray-500">
          A live, conservative cost range. Final quote (with multi-band
          discounting and your specific routes) is generated when our team
          confirms your district.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-400">District type</span>
          <select
            value={districtType}
            onChange={(e) =>
              setDistrictType(e.target.value as "federal" | "state" | "local")
            }
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="local">Local (city / county / school board)</option>
            <option value="state">State (legislature / row office)</option>
            <option value="federal">Federal (US House / US Senate)</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-400">
            Estimated households
          </span>
          <input
            type="number"
            min={500}
            step={500}
            value={households}
            onChange={(e) => setHouseholds(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-400">
            Drops (1–5 waves)
          </span>
          <input
            type="number"
            min={1}
            max={5}
            value={drops}
            onChange={(e) => setDrops(Number(e.target.value) || 1)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </label>

        <div className="space-y-1.5 pt-1">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={includeSetup}
              onChange={(e) => setIncludeSetup(e.target.checked)}
              className="rounded border-gray-700 bg-gray-950 text-blue-500"
            />
            Include setup ({fmtUsd(SETUP_FEE_CENTS)})
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={includeDesign}
              onChange={(e) => setIncludeDesign(e.target.checked)}
              className="rounded border-gray-700 bg-gray-950 text-blue-500"
            />
            Include design ({fmtUsd(DESIGN_FEE_CENTS)})
          </label>
        </div>
      </div>

      <div className="space-y-1.5 border-t border-gray-800 pt-4 text-sm">
        <div className="flex justify-between text-gray-400">
          <span>Total pieces</span>
          <span className="font-mono text-white">
            {result.totalPieces.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Per piece</span>
          <span className="font-mono text-white">
            ${(result.pieceCents / 100).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Pieces subtotal</span>
          <span className="font-mono text-white">{fmtUsd(result.subtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Add-ons</span>
          <span className="font-mono text-white">{fmtUsd(result.addOns)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-800 pt-2 text-base">
          <span className="font-bold text-white">Estimated total</span>
          <span className="font-mono font-bold text-emerald-400">
            {fmtUsd(result.total)}
          </span>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-gray-500">
        Range based on standard postcard rates for {districtType}-level
        districts. Multi-band discounts and route-level optimization can
        lower this materially. Final pricing confirmed in your proposal.
      </p>
    </aside>
  );
}
