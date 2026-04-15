"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadMatch = {
  id: string;
  business_name: string;
  city: string | null;
  category: string | null;
  phone: string | null;
};

type SearchResult = {
  leads: LeadMatch[];
};

// ─── Outcome Buttons ──────────────────────────────────────────────────────────

const OUTCOMES = [
  { id: "completed", emoji: "☎️", label: "Completed", color: "blue" },
  { id: "no_answer", emoji: "📵", label: "No Answer", color: "gray" },
  { id: "left_voicemail", emoji: "📨", label: "Voicemail", color: "gray" },
  { id: "interested", emoji: "🔥", label: "Interested!", color: "green" },
  { id: "wants_info", emoji: "📋", label: "Wants Info", color: "green" },
  { id: "call_back_later", emoji: "🔁", label: "Call Back", color: "yellow" },
  { id: "bad_number", emoji: "❌", label: "Bad Number", color: "red" },
  { id: "not_interested", emoji: "✋", label: "Not Interested", color: "gray" },
  { id: "wrong_fit", emoji: "🚫", label: "Wrong Fit", color: "gray" },
];

const getOutcomeColor = (
  color: string,
  selected: boolean
): string => {
  if (!selected) {
    const colorMap: Record<string, string> = {
      blue: "bg-blue-100 text-blue-700 hover:bg-blue-200",
      green: "bg-green-100 text-green-700 hover:bg-green-200",
      yellow: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
      red: "bg-red-100 text-red-700 hover:bg-red-200",
      gray: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    };
    return colorMap[color] || colorMap.gray;
  }

  const selectedMap: Record<string, string> = {
    blue: "bg-blue-600 text-white",
    green: "bg-green-600 text-white",
    yellow: "bg-yellow-600 text-white",
    red: "bg-red-600 text-white",
    gray: "bg-gray-600 text-white",
  };
  return selectedMap[color] || selectedMap.gray;
};

// ─── Component ────────────────────────────────────────────────────────────────

interface QuickCallLogProps {
  agentId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function QuickCallLog({
  agentId,
  onClose,
  onSaved,
}: QuickCallLogProps) {
  const [businessInput, setBusinessInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [infoSent, setInfoSent] = useState(false);
  const [dealCreated, setDealCreated] = useState(false);
  const [searchResults, setSearchResults] = useState<LeadMatch[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  const searchLeads = useCallback(
    (query: string) => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          // Search for leads by business name or phone
          const params = new URLSearchParams();
          if (/^\d{3}/.test(query)) {
            // Looks like a phone number
            params.append("phone", query);
          } else {
            params.append("business_name", query);
          }

          const res = await fetch(`/api/admin/sales/call-list?agent_id=${agentId}`);
          if (res.ok) {
            const data = await res.json();
            const leads: LeadMatch[] = data.leads.filter((lead: any) => {
              const matchesName =
                lead.business_name?.toLowerCase().includes(query.toLowerCase());
              const matchesPhone = lead.phone?.includes(query);
              return matchesName || matchesPhone;
            });
            setSearchResults(leads.slice(0, 5));
          }
        } catch (err) {
          console.error("Search error:", err);
        }
        setSearchLoading(false);
      }, 300);
    },
    [agentId]
  );

  const handleBusinessChange = (value: string) => {
    setBusinessInput(value);
    setShowSearchDropdown(true);
    searchLeads(value);
  };

  const handlePhoneChange = (value: string) => {
    setPhoneInput(value);
    setShowSearchDropdown(true);
    searchLeads(value);
  };

  const selectLead = (lead: LeadMatch) => {
    setSelectedLead(lead);
    setBusinessInput(lead.business_name);
    setPhoneInput(lead.phone || "");
    setSearchResults([]);
    setShowSearchDropdown(false);
  };

  // Save call
  const handleSave = async () => {
    if (!selectedOutcome) {
      alert("Please select an outcome");
      return;
    }

    const businessName = selectedLead?.business_name || businessInput;
    const phone = selectedLead?.phone || phoneInput;

    if (!businessName && !phone) {
      alert("Please enter a business name or phone number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/sales/call-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          lead_id: selectedLead?.id || null,
          business_name: businessName,
          phone: phone,
          city: selectedLead?.city || null,
          category: selectedLead?.category || null,
          outcome: selectedOutcome,
          notes: note,
          source: "manual",
          follow_up_created: followUpNeeded,
          follow_up_date: followUpNeeded ? followUpDate : null,
          info_sent: infoSent,
          deal_created: dealCreated || selectedOutcome === "deal_created",
        }),
      });

      if (!res.ok) {
        alert("Failed to save call");
        setLoading(false);
        return;
      }

      const result = await res.json();

      // Show success message
      if (result.enrichment_result?.enriched) {
        console.log("✓ Matched to", selectedLead?.business_name);
      } else if (result.enrichment_result?.needs_review) {
        console.log("⚠️ No match found — saved for review");
      }

      onSaved();
    } catch (err) {
      console.error("Error saving call:", err);
      alert("Error saving call");
    }
    setLoading(false);
  };

  // Close on ESC
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [onClose]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {/* Modal Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Quick Call Log</h2>
              <p className="text-sm text-gray-600">
                Log a call in seconds — we'll fill in the rest
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Business / Phone Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Business Name or Phone
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Business name or phone number"
                  value={businessInput || phoneInput}
                  onChange={(e) => {
                    if (/^\d{3}/.test(e.target.value)) {
                      handlePhoneChange(e.target.value);
                    } else {
                      handleBusinessChange(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />

                {/* Search Dropdown */}
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                    {searchResults.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => selectLead(lead)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0 text-sm"
                      >
                        <div className="font-semibold text-gray-900">
                          {lead.business_name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {lead.city && <span>{lead.city}</span>}
                          {lead.city && lead.category && <span> • </span>}
                          {lead.category && <span>{lead.category}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchLoading && (
                  <div className="absolute right-3 top-2.5 text-gray-500 text-sm">
                    Searching...
                  </div>
                )}

                {/* Selected Lead Badge */}
                {selectedLead && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    <div className="font-semibold text-blue-900">
                      {selectedLead.business_name}
                    </div>
                    <div className="text-xs text-blue-700">
                      {selectedLead.city && <span>{selectedLead.city}</span>}
                      {selectedLead.city && selectedLead.category && <span> • </span>}
                      {selectedLead.category && <span>{selectedLead.category}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Outcome Buttons */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Outcome *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {OUTCOMES.map((outcome) => (
                  <button
                    key={outcome.id}
                    onClick={() => setSelectedOutcome(outcome.id)}
                    className={`px-2 py-2 text-xs font-medium rounded-lg transition-colors ${getOutcomeColor(
                      outcome.color,
                      selectedOutcome === outcome.id
                    )}`}
                  >
                    <div>{outcome.emoji}</div>
                    <div className="text-xs leading-tight mt-1">{outcome.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Quick Note (optional)
              </label>
              <textarea
                placeholder="Any notes about this call..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm resize-none"
                rows={3}
              />
            </div>

            {/* Advanced Toggle */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                {showAdvanced ? "Hide more options ▲" : "Show more options ▼"}
              </button>
            </div>

            {/* Advanced Options */}
            {showAdvanced && (
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="followUpNeeded"
                    checked={followUpNeeded}
                    onChange={(e) => setFollowUpNeeded(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label
                    htmlFor="followUpNeeded"
                    className="text-sm text-gray-700 font-medium"
                  >
                    Follow-up needed?
                  </label>
                </div>

                {followUpNeeded && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Follow-up Date
                    </label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="infoSent"
                    checked={infoSent}
                    onChange={(e) => setInfoSent(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="infoSent" className="text-sm text-gray-700 font-medium">
                    Info sent?
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="dealCreated"
                    checked={dealCreated}
                    onChange={(e) => setDealCreated(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="dealCreated" className="text-sm text-gray-700 font-medium">
                    Deal created?
                  </label>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !selectedOutcome}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
              >
                {loading ? "Saving..." : "Log Call →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
