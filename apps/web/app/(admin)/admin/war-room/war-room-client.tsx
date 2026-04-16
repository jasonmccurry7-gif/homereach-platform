"use client";

import { useEffect, useState } from "react";

interface WarRoomData {
  todaysSalesEvents: Array<{
    id: string;
    agentId: string;
    leadId: string;
    actionType: string;
    channel: string;
    city: string;
    category: string;
    message: string;
    revenueCents: number | null;
    createdAt: string;
  }>;
  salesLeadsByStatus: Array<{
    id: string;
    businessName: string;
    city: string;
    category: string;
    status: string;
    lastReplyAt: string | null;
    phone: string | null;
    email: string | null;
    assignedAgentId: string | null;
  }>;
  agentDailyStats: Array<{
    agentId: string;
    fullName: string;
    textsSent: number;
    emailsSent: number;
    callsMade: number;
    hotLeads: number;
    dealsClosed: number;
  }>;
}

const TARGETS = {
  texts: { daily: 20, midday: 10 },
  emails: { daily: 20, midday: 10 },
  calls: { daily: 15, midday: 5 },
};

function getTimeOfDay(): "morning" | "midday" | "end" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "midday";
  return "end";
}

function isBehindPace(count: number, target: number): boolean {
  const hour = new Date().getHours();
  const minutesPassed = hour * 60 + new Date().getMinutes();
  const minutesInDay = 24 * 60;
  const pctDayPassed = minutesPassed / minutesInDay;
  const expectedCount = target * pctDayPassed;
  return count < expectedCount;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function calculateRevenue(events: WarRoomData["todaysSalesEvents"]): number {
  return events.reduce((sum, e) => sum + (e.revenueCents || 0), 0) / 100;
}

function calculatePipelineValue(
  leads: WarRoomData["salesLeadsByStatus"]
): number {
  // Simple estimation: assume avg deal value of $800
  return leads.length * 800;
}

function countDealsClosed(
  events: WarRoomData["todaysSalesEvents"]
): number {
  return events.filter((e) => e.actionType === "deal_closed").length;
}

function countHotLeads(leads: WarRoomData["salesLeadsByStatus"]): number {
  return leads.filter((l) => l.status === "interested").length;
}

function timeUntilEndOfDay(): string {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(17, 0, 0, 0);
  const diffMs = endOfDay.getTime() - now.getTime();
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

async function alertRep(leadId: string) {
  try {
    const res = await fetch("/api/admin/sales/alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    });
    if (!res.ok) throw new Error("Failed to alert rep");
    alert("Rep alerted!");
  } catch (err) {
    alert("Error alerting rep");
  }
}

export default function WarRoomClient({ data }: { data: WarRoomData }) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const revenue = calculateRevenue(data.todaysSalesEvents);
  const pipelineValue = calculatePipelineValue(data.salesLeadsByStatus);
  const dealsClosed = countDealsClosed(data.todaysSalesEvents);
  const hotLeads = countHotLeads(data.salesLeadsByStatus);

  const recentHotLeads = data.salesLeadsByStatus
    .filter((l) => l.status === "replied" || l.status === "interested")
    .sort(
      (a, b) =>
        new Date(b.lastReplyAt || 0).getTime() -
        new Date(a.lastReplyAt || 0).getTime()
    )
    .slice(0, 5);

  const stallRisks = data.salesLeadsByStatus.filter((l) => {
    if (!l.lastReplyAt) return false;
    const daysAgo =
      (new Date().getTime() - new Date(l.lastReplyAt).getTime()) /
      (1000 * 60 * 60 * 24);
    return daysAgo >= 5;
  });

  const lossReasons = data.todaysSalesEvents
    .filter((e) => ["not_interested", "wrong_fit"].includes(e.actionType))
    .reduce(
      (acc, e) => {
        acc[e.actionType] = (acc[e.actionType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

  const closingDeals = data.salesLeadsByStatus.filter(
    (l) => l.status === "payment_sent"
  );

  return (
    <div key={refreshKey} className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">🎯 War Room</h1>
            <p className="text-gray-400 mt-2">Real-time sales execution dashboard</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-400">
              {timeUntilEndOfDay()} left
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Row 1: Revenue Bar (4 chips) */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">💰 Revenue Today</p>
            <p className="text-3xl font-bold text-green-400">${revenue.toFixed(0)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">📊 Pipeline Value</p>
            <p className="text-3xl font-bold text-blue-400">
              ${pipelineValue.toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">✅ Deals Closed</p>
            <p className="text-3xl font-bold text-purple-400">{dealsClosed}</p>
          </div>
          <div
            className={`bg-gray-900 border rounded-lg p-4 ${
              hotLeads > 0 ? "border-red-600" : "border-gray-800"
            }`}
          >
            <p className="text-gray-400 text-sm mb-1">🔥 Hot Leads</p>
            <p
              className={`text-3xl font-bold ${
                hotLeads > 0 ? "text-red-400" : "text-gray-400"
              }`}
            >
              {hotLeads}
            </p>
          </div>
        </div>

        {/* Row 2: Rep Performance Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold">📈 Rep Performance (Today)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-6 py-3 text-left font-semibold text-gray-400">
                    Agent
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-400">
                    Texts
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-400">
                    Emails
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-400">
                    Calls
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-400">
                    Hot Leads
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-400">
                    Deals
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.agentDailyStats.map((agent) => {
                  const textsBehind = isBehindPace(
                    agent.textsSent,
                    TARGETS.texts.daily
                  );
                  const emailsBehind = isBehindPace(
                    agent.emailsSent,
                    TARGETS.emails.daily
                  );
                  const callsBehind = isBehindPace(
                    agent.callsMade,
                    TARGETS.calls.daily
                  );
                  const anyBehind = textsBehind || emailsBehind || callsBehind;

                  return (
                    <tr
                      key={agent.agentId}
                      className="hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-6 py-3 font-medium">{agent.fullName}</td>
                      <td
                        className={`px-6 py-3 text-center ${
                          textsBehind ? "text-red-400 font-semibold" : ""
                        }`}
                      >
                        {agent.textsSent}/{TARGETS.texts.daily}
                      </td>
                      <td
                        className={`px-6 py-3 text-center ${
                          emailsBehind ? "text-red-400 font-semibold" : ""
                        }`}
                      >
                        {agent.emailsSent}/{TARGETS.emails.daily}
                      </td>
                      <td
                        className={`px-6 py-3 text-center ${
                          callsBehind ? "text-red-400 font-semibold" : ""
                        }`}
                      >
                        {agent.callsMade}/{TARGETS.calls.daily}
                      </td>
                      <td className="px-6 py-3 text-center text-blue-400">
                        {agent.hotLeads}
                      </td>
                      <td className="px-6 py-3 text-center text-green-400 font-semibold">
                        {agent.dealsClosed}
                      </td>
                      <td className="px-6 py-3 text-center">
                        {anyBehind ? (
                          <span className="inline-block px-2 py-1 bg-red-600 text-white text-xs rounded font-semibold">
                            ⚠️ Behind
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-1 bg-green-600 text-white text-xs rounded font-semibold">
                            ✓ On pace
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Row 3: Hot Leads Right Now */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold">🔥 Hot Leads Right Now</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {recentHotLeads.length === 0 ? (
              <p className="col-span-full text-gray-400 text-center py-8">
                No hot leads yet today
              </p>
            ) : (
              recentHotLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-4"
                >
                  <div className="mb-3">
                    <h3 className="font-semibold text-white">
                      {lead.businessName}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {lead.city}, {lead.category}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Replied {formatTimeAgo(lead.lastReplyAt || "")}
                  </p>
                  <button
                    onClick={() => alertRep(lead.id)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded transition-colors"
                  >
                    📢 Alert Rep
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Row 4: Deals Closing (payment_sent) */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold">
              💵 Deals Closing Today (Payment Sent)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-6 py-3 text-left font-semibold text-gray-400">
                    Business
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-400">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-400">
                    Category
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-400">
                    Days at Stage
                  </th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-400">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {closingDeals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                      No deals at payment_sent stage today
                    </td>
                  </tr>
                ) : (
                  closingDeals.map((deal) => {
                    const lastRepliedAt = deal.lastReplyAt
                      ? new Date(deal.lastReplyAt).getTime()
                      : Date.now();
                    const daysAtStage = Math.floor(
                      (Date.now() - lastRepliedAt) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <tr
                        key={deal.id}
                        className="hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-6 py-3 font-medium">
                          {deal.businessName}
                        </td>
                        <td className="px-6 py-3">{deal.city}</td>
                        <td className="px-6 py-3">{deal.category}</td>
                        <td className="px-6 py-3 text-center text-yellow-400 font-semibold">
                          {daysAtStage}d
                        </td>
                        <td className="px-6 py-3 text-center">
                          <button className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded font-semibold transition-colors">
                            🔔 Chase
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Row 5: At Risk */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold">⚠️ At Risk (5+ days no movement)</h2>
          </div>
          <div className="px-6 py-6">
            {stallRisks.length === 0 ? (
              <p className="text-gray-400 text-center">No at-risk leads</p>
            ) : (
              <div className="space-y-3">
                {stallRisks.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between bg-gray-800 p-4 rounded"
                  >
                    <div>
                      <p className="font-semibold">{lead.businessName}</p>
                      <p className="text-sm text-gray-400">
                        {lead.city} • {lead.category}
                      </p>
                    </div>
                    <span className="text-sm text-red-400 font-semibold">
                      {Math.floor(
                        (Date.now() - new Date(lead.lastReplyAt || "").getTime()) /
                          (1000 * 60 * 60 * 24)
                      )}
                      d stalled
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 6: Lost Deal Intelligence */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold">📉 Lost Deal Intelligence</h2>
          </div>
          <div className="px-6 py-6">
            {Object.keys(lossReasons).length === 0 ? (
              <p className="text-gray-400 text-center">
                No losses recorded today
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(lossReasons).map(([reason, count]) => (
                  <div
                    key={reason}
                    className="flex items-center justify-between bg-gray-800 p-4 rounded"
                  >
                    <p className="font-semibold capitalize">{reason}</p>
                    <span className="text-lg font-bold text-red-400">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
