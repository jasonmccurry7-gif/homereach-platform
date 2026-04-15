"use client";

import { useState, useEffect } from "react";

// Revenue Visibility Strip — "ENGINE 10"
// Shows: closed today · pipeline value · at-risk value

interface RevenueData {
  closed_today_cents: number;
  pipeline_cents: number;
  at_risk_cents: number;
  deals_today: number;
  hot_leads: number;
}

export default function RevenueStrip({ agentId }: { agentId: string }) {
  const [data, setData] = useState<RevenueData | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, atRiskRes] = await Promise.all([
          fetch(`/api/admin/sales/call-stats?agent_id=${agentId}&period=today`),
          fetch(`/api/admin/sales/at-risk?agent_id=${agentId}`),
        ]);
        const stats  = await statsRes.json();
        const atRisk = await atRiskRes.json();

        setData({
          closed_today_cents:  (stats.stats?.deals ?? 0) * 40000,
          pipeline_cents:      (stats.stats?.interested ?? 0) * 40000,
          at_risk_cents:       (atRisk.total_at_risk ?? 0) * 40000,
          deals_today:         stats.stats?.deals ?? 0,
          hot_leads:           stats.stats?.interested ?? 0,
        });
      } catch { /* silent */ }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [agentId]);

  if (!data) return null;

  const fmt = (cents: number) => cents >= 100000
    ? `$${(cents / 10000).toFixed(1)}K`
    : `$${(cents / 100).toFixed(0)}`;

  return (
    <div className="flex gap-3 px-6 py-2 bg-gray-950 border-b border-gray-800 overflow-x-auto">
      <RevenueChip
        label="Closed Today"
        value={data.deals_today > 0 ? `${fmt(data.closed_today_cents)} · ${data.deals_today} deal${data.deals_today !== 1 ? "s" : ""}` : "—"}
        color={data.deals_today > 0 ? "text-emerald-400" : "text-gray-600"}
        icon="🏆"
      />
      <RevenueChip
        label="Pipeline"
        value={data.hot_leads > 0 ? `${fmt(data.pipeline_cents)} · ${data.hot_leads} hot` : "—"}
        color={data.hot_leads > 0 ? "text-amber-400" : "text-gray-600"}
        icon="🔥"
      />
      <RevenueChip
        label="At Risk"
        value={data.at_risk_cents > 0 ? fmt(data.at_risk_cents) : "None"}
        color={data.at_risk_cents > 0 ? "text-red-400" : "text-gray-600"}
        icon={data.at_risk_cents > 0 ? "⚠️" : "✅"}
      />
    </div>
  );
}

function RevenueChip({ label, value, color, icon }: {
  label: string; value: string; color: string; icon: string;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-xs">{icon}</span>
      <div>
        <p className="text-[10px] text-gray-600 uppercase tracking-wide leading-none">{label}</p>
        <p className={`text-xs font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}
