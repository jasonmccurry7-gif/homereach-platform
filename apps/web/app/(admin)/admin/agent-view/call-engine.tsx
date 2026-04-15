"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import QuickCallLog from "./quick-call-log";

// ─── Types ────────────────────────────────────────────────────────────────────

type CallListResponse = {
  list: {
    id: string;
    agent_id: string;
    list_date: string;
    target_calls: number;
    list_size: number;
  };
  leads: Array<{
    id: string;
    business_name: string;
    phone: string | null;
    city: string | null;
    category: string | null;
    contact_name: string | null;
    score: number;
    buying_signal: boolean;
    status: string;
    last_contacted_at: string | null;
    source: string;
  }>;
  today_stats: {
    completed: number;
    connected: number;
    no_answer: number;
    voicemail: number;
    interested: number;
    follow_ups: number;
    deals: number;
  };
  already_called: string[];
};

type CallScript = {
  id: string;
  category: string;
  variant: string;
  label: string;
  script: string;
};

type Lead = CallListResponse["leads"][0];

type Flash = { msg: string; ok: boolean } | null;

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CallEngine({ agentId }: { agentId: string }) {
  const [callList, setCallList] = useState<CallListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [scripts, setScripts] = useState<Record<string, CallScript[]>>({});
  const [scriptLoading, setScriptLoading] = useState<Record<string, boolean>>({});
  const [activeScriptIndex, setActiveScriptIndex] = useState<Record<string, number>>({});
  const [nextStepLeadId, setNextStepLeadId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load call list on mount
  useEffect(() => {
    const loadCallList = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/sales/call-list?agent_id=${agentId}`);
        if (!res.ok) {
          showFlash("Failed to load call list", false);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setCallList(data);
      } catch (err) {
        showFlash("Error loading call list", false);
      }
      setLoading(false);
    };
    loadCallList();
  }, [agentId]);

  // Show flash message
  const showFlash = (msg: string, ok = true) => {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 3000);
  };

  // Fetch scripts for a lead's category
  const loadScripts = useCallback(
    async (leadId: string, category: string | null) => {
      if (!category) return;

      const cacheKey = `${leadId}-${category}`;
      if (scripts[cacheKey]) return;

      setScriptLoading((prev) => ({ ...prev, [cacheKey]: true }));
      try {
        const res = await fetch(`/api/admin/sales/call-scripts?category=${category}`);
        if (res.ok) {
          const data = await res.json();
          setScripts((prev) => ({
            ...prev,
            [cacheKey]: data.scripts || [],
          }));
          setActiveScriptIndex((prev) => ({
            ...prev,
            [cacheKey]: 0,
          }));
        }
      } catch (err) {
        console.error("Failed to load scripts:", err);
      }
      setScriptLoading((prev) => ({ ...prev, [cacheKey]: false }));
    },
    [scripts]
  );

  // Log call outcome
  const logCallOutcome = useCallback(
    async (lead: Lead, outcome: string) => {
      try {
        const res = await fetch("/api/admin/sales/call-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: agentId,
            lead_id: lead.id,
            business_name: lead.business_name,
            phone: lead.phone,
            city: lead.city,
            category: lead.category,
            contact_name: lead.contact_name,
            outcome,
            source: "dialer",
            call_list_id: callList?.list.id,
          }),
        });

        if (!res.ok) {
          showFlash("Failed to log call", false);
          return;
        }

        // Refresh call list stats
        const listRes = await fetch(
          `/api/admin/sales/call-list?agent_id=${agentId}`
        );
        if (listRes.ok) {
          const data = await listRes.json();
          setCallList(data);
        }

        // Show next step section for positive outcomes
        if (["interested", "wants_info"].includes(outcome)) {
          setNextStepLeadId(lead.id);
        }

        showFlash(`✓ Logged: ${outcome.replace(/_/g, " ")}`);
        setActiveCallId(null);
      } catch (err) {
        showFlash("Error logging call", false);
      }
    },
    [agentId, callList?.list.id]
  );

  // Copy script to clipboard
  const copyScript = (leadId: string, category: string | null) => {
    if (!category) return;
    const cacheKey = `${leadId}-${category}`;
    const scriptList = scripts[cacheKey];
    if (!scriptList || !scriptList.length) return;

    const activeIdx = activeScriptIndex[cacheKey] || 0;
    const scriptText = scriptList[activeIdx]?.script || "";

    navigator.clipboard.writeText(scriptText);
    showFlash("✓ Script copied");
  };

  // Load more calls
  const loadMore = async () => {
    if (!callList) return;
    try {
      const res = await fetch("/api/admin/sales/call-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          action: "load_more",
          count: 10,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Reload full call list
        const listRes = await fetch(
          `/api/admin/sales/call-list?agent_id=${agentId}`
        );
        if (listRes.ok) {
          const updatedList = await listRes.json();
          setCallList(updatedList);
          showFlash("✓ Loaded 10 more calls");
        }
      }
    } catch (err) {
      showFlash("Error loading more calls", false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading call list...</div>
      </div>
    );
  }

  if (!callList) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-red-500">Failed to load call list</div>
      </div>
    );
  }

  const { list, leads, today_stats, already_called } = callList;
  const progressPercent = Math.round(
    ((today_stats.completed || 0) / (list.target_calls || 1)) * 100
  );
  const progressColor =
    today_stats.completed >= 10
      ? "bg-green-500"
      : today_stats.completed >= 5
        ? "bg-yellow-500"
        : "bg-red-500";

  const remainingCalls = leads.filter(
    (lead) => !already_called.includes(lead.id)
  );
  const displayLeads = remainingCalls.slice(0, Math.min(remainingCalls.length, 20));

  return (
    <div className="w-full max-w-6xl mx-auto p-4 pb-20">
      {/* Flash Messages */}
      {flash && (
        <div
          className={`fixed top-4 right-4 px-4 py-2 rounded-lg text-white z-50 ${
            flash.ok ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {flash.msg}
        </div>
      )}

      {/* Header Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">📞 Today's Call List</h1>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 text-sm text-blue-600 hover:underline"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => setShowQuickLog(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + Quick Log
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">
            {today_stats.completed} / {list.target_calls} calls completed
          </span>
          <span className="text-sm text-gray-500">{progressPercent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${progressColor}`}
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {today_stats.completed}
          </div>
          <div className="text-xs text-gray-600">Calls Done</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {today_stats.connected}
          </div>
          <div className="text-xs text-gray-600">Connected</div>
        </div>
        <div
          className={`bg-white rounded-lg border ${
            today_stats.interested > 0 ? "border-green-200" : "border-gray-200"
          } p-3 text-center`}
        >
          <div
            className={`text-2xl font-bold ${
              today_stats.interested > 0 ? "text-green-600" : "text-gray-900"
            }`}
          >
            {today_stats.interested}
          </div>
          <div className="text-xs text-gray-600">Interested</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">
            {today_stats.follow_ups}
          </div>
          <div className="text-xs text-gray-600">Follow-Ups</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {today_stats.deals}
          </div>
          <div className="text-xs text-gray-600">Deals</div>
        </div>
      </div>

      {/* Remaining calls counter */}
      <div className="mb-6 text-sm text-gray-600">
        {remainingCalls.length} calls remaining
      </div>

      {/* Call List */}
      <div ref={scrollRef} className="space-y-3 mb-8">
        {displayLeads.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            No calls to make today. Great job!
          </div>
        ) : (
          displayLeads.map((lead) => {
            const isActive = activeCallId === lead.id;
            const cacheKey = `${lead.id}-${lead.category}`;
            const scriptList = scripts[cacheKey] || [];
            const isAlreadyCalled = already_called.includes(lead.id);

            return (
              <div
                key={lead.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden transition-all"
              >
                {/* Collapsed/Collapsed Header */}
                <button
                  onClick={() => {
                    setActiveCallId(isActive ? null : lead.id);
                    if (!isActive && lead.category) {
                      loadScripts(lead.id, lead.category);
                    }
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      {lead.business_name}
                      {isAlreadyCalled && (
                        <span className="inline-block px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded">
                          Called ✓
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {lead.phone && (
                        <span>
                          {lead.phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}
                        </span>
                      )}
                      {lead.city && <span className="ml-3">📍 {lead.city}</span>}
                      {lead.category && <span className="ml-3">🏢 {lead.category}</span>}
                    </div>
                    {lead.last_contacted_at && (
                      <div className="text-xs text-gray-500 mt-1">
                        Last contacted:{" "}
                        {new Date(lead.last_contacted_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-blue-600">
                      Score: {lead.score}
                    </div>
                    <div className="text-xs text-gray-500">
                      {isActive ? "▼" : "▶"}
                    </div>
                  </div>
                </button>

                {/* Expanded View */}
                {isActive && !isAlreadyCalled && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    {/* Business Info */}
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {lead.business_name}
                      </h3>
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className="text-lg text-blue-600 hover:underline font-medium mb-2 block"
                        >
                          📞 {lead.phone}
                        </a>
                      )}
                      <div className="flex gap-4 text-sm text-gray-700 mb-4">
                        {lead.contact_name && (
                          <div>
                            <span className="font-semibold">Contact:</span> {lead.contact_name}
                          </div>
                        )}
                        {lead.city && (
                          <div>
                            <span className="font-semibold">City:</span> {lead.city}
                          </div>
                        )}
                        {lead.category && (
                          <div>
                            <span className="font-semibold">Category:</span> {lead.category}
                          </div>
                        )}
                      </div>
                      <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        Lead Score: {lead.score}
                      </div>
                    </div>

                    {/* Script Section */}
                    {lead.category && (
                      <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">Call Script</h4>
                          <div className="flex gap-2">
                            {scriptList.length > 0 && (
                              <button
                                onClick={() => copyScript(lead.id, lead.category)}
                                className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700"
                              >
                                📋 Copy
                              </button>
                            )}
                          </div>
                        </div>

                        {scriptLoading[cacheKey] ? (
                          <div className="text-sm text-gray-500">Loading script...</div>
                        ) : scriptList.length === 0 ? (
                          <div className="text-sm text-gray-500">No script available</div>
                        ) : (
                          <>
                            {/* Script tabs */}
                            {scriptList.length > 1 && (
                              <div className="flex gap-2 mb-3 border-b border-gray-200">
                                {scriptList.map((_, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() =>
                                      setActiveScriptIndex((prev) => ({
                                        ...prev,
                                        [cacheKey]: idx,
                                      }))
                                    }
                                    className={`text-sm px-2 py-1 ${
                                      (activeScriptIndex[cacheKey] || 0) === idx
                                        ? "text-blue-600 font-semibold border-b-2 border-blue-600"
                                        : "text-gray-600 hover:text-gray-900"
                                    }`}
                                  >
                                    {idx === 0 ? "Primary" : `Alt ${idx}`}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Script text */}
                            <div className="text-sm text-gray-700 whitespace-pre-wrap bg-blue-50 p-3 rounded border border-blue-100">
                              {scriptList[(activeScriptIndex[cacheKey] || 0)]?.script.replace(
                                /\[CITY\]/g,
                                lead.city || "the area"
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Outcome Buttons */}
                    <div className="space-y-3">
                      {/* Row 1: Neutral/Negative */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <button
                          onClick={() => logCallOutcome(lead, "completed")}
                          className="px-2 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          ☎️ Completed
                        </button>
                        <button
                          onClick={() => logCallOutcome(lead, "no_answer")}
                          className="px-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          📵 No Answer
                        </button>
                        <button
                          onClick={() => logCallOutcome(lead, "left_voicemail")}
                          className="px-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          📨 Voicemail
                        </button>
                        <button
                          onClick={() => logCallOutcome(lead, "bad_number")}
                          className="px-2 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          ❌ Bad Num
                        </button>
                        <button
                          onClick={() => logCallOutcome(lead, "gatekeeper")}
                          className="px-2 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          🚧 Gate
                        </button>
                      </div>

                      {/* Row 2: Positive/Action */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <button
                          onClick={() => logCallOutcome(lead, "interested")}
                          className="col-span-2 sm:col-span-1 px-2 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors text-sm"
                        >
                          🔥 Interested!
                        </button>
                        <button
                          onClick={() => logCallOutcome(lead, "wants_info")}
                          className="px-2 py-2 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          📋 Info
                        </button>
                        <button
                          onClick={() => logCallOutcome(lead, "call_back_later")}
                          className="px-2 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          🔁 CB Later
                        </button>
                        <button
                          onClick={() => logCallOutcome(lead, "not_interested")}
                          className="px-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          ✋ Not Int
                        </button>
                        <button
                          onClick={() => logCallOutcome(lead, "wrong_fit")}
                          className="px-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          🚫 Wrong Fit
                        </button>
                      </div>
                    </div>

                    {/* Next Step Section */}
                    {nextStepLeadId === lead.id && (
                      <div className="mt-4 p-4 bg-green-50 border-l-4 border-green-500 rounded">
                        <div className="font-bold text-green-900 mb-3">
                          🔥 This lead is interested — act now!
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <button
                            onClick={() => {
                              showFlash("✓ Text sent");
                              setNextStepLeadId(null);
                            }}
                            className="px-2 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors"
                          >
                            📱 Send Text
                          </button>
                          <button
                            onClick={() => {
                              showFlash("✓ Email sent");
                              setNextStepLeadId(null);
                            }}
                            className="px-2 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors"
                          >
                            📧 Send Email
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `https://homereach.com/intake?lead_id=${lead.id}`
                              );
                              showFlash("✓ Link copied");
                            }}
                            className="px-2 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors"
                          >
                            🔗 Copy Link
                          </button>
                          <button
                            onClick={() => {
                              showFlash("✓ Pricing shared");
                              setNextStepLeadId(null);
                            }}
                            className="px-2 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors"
                          >
                            💰 Pricing
                          </button>
                          <button
                            onClick={() => {
                              showFlash("✓ Follow-up scheduled");
                              setNextStepLeadId(null);
                            }}
                            className="px-2 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors"
                          >
                            📅 Schedule
                          </button>
                          <button
                            onClick={() => {
                              logCallOutcome(lead, "deal_created");
                              setNextStepLeadId(null);
                            }}
                            className="px-2 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-colors"
                          >
                            🏆 Deal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Load More Button */}
      {remainingCalls.length > displayLeads.length && (
        <div className="text-center mb-8">
          <button
            onClick={loadMore}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium rounded-lg transition-colors"
          >
            Load 10 More
          </button>
        </div>
      )}

      {/* Quick Call Log Modal */}
      {showQuickLog && (
        <QuickCallLog
          agentId={agentId}
          onClose={() => setShowQuickLog(false)}
          onSaved={() => {
            setShowQuickLog(false);
            // Reload call list
            fetch(`/api/admin/sales/call-list?agent_id=${agentId}`)
              .then((r) => r.json())
              .then((data) => setCallList(data));
            showFlash("✓ Call logged");
          }}
        />
      )}
    </div>
  );
}
