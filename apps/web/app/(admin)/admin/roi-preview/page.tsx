import type { Metadata } from "next";
import type { CampaignMetrics } from "@/lib/engine/types";
import { MockDataBanner } from "@/components/admin/mock-data-banner";

export const metadata: Metadata = { title: "ROI Dashboard Preview — HomeReach Admin" };

// ── Mock client data ──────────────────────────────────────────────────────────
// TODO: Replace with real query:
//   SELECT * FROM campaign_metrics WHERE business_id = $businessId
//   ORDER BY month DESC LIMIT 6
const MOCK_BUSINESS = {
  name: "Harrington Plumbing",
  ownerName: "Mike Harrington",
  city: "Medina, OH",
  category: "Plumber",
  homesPerMonth: 2500,
  startDate: "2026-02-01",
  nextDrop: "2026-05-01",
  bundleName: "Visibility",
  monthlyRate: 299,
};

const MOCK_METRICS: (CampaignMetrics & { monthLabel: string })[] = [
  { businessId: "biz-1", month: "2026-02", monthLabel: "Feb",  homesReached: 2500, qrScans: 47,  calls: 12, formLeads: 4,  estimatedRevenue: 0 },
  { businessId: "biz-1", month: "2026-03", monthLabel: "Mar",  homesReached: 2500, qrScans: 61,  calls: 18, formLeads: 6,  estimatedRevenue: 0 },
  { businessId: "biz-1", month: "2026-04", monthLabel: "Apr",  homesReached: 2500, qrScans: 58,  calls: 21, formLeads: 8,  estimatedRevenue: 0 },
];

const CURRENT = MOCK_METRICS[MOCK_METRICS.length - 1];
const PREV    = MOCK_METRICS[MOCK_METRICS.length - 2];

function pctChange(curr: number, prev: number) {
  if (prev === 0) return null;
  const pct = Math.round(((curr - prev) / prev) * 100);
  return pct;
}

function TrendChip({ curr, prev }: { curr: number; prev: number }) {
  const pct = pctChange(curr, prev);
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
      up ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
    }`}>
      {up ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  );
}

const BAR_MAX = Math.max(...MOCK_METRICS.map((m) => m.qrScans + m.calls + m.formLeads));

export default function RoiPreviewPage() {
  const totalHomesReached = MOCK_METRICS.reduce((s, m) => s + m.homesReached, 0);
  const totalQrScans      = MOCK_METRICS.reduce((s, m) => s + m.qrScans, 0);
  const totalCalls        = MOCK_METRICS.reduce((s, m) => s + m.calls, 0);
  const totalFormLeads    = MOCK_METRICS.reduce((s, m) => s + m.formLeads, 0);
  const totalActions      = totalQrScans + totalCalls + totalFormLeads;

  return (
    <div className="max-w-4xl space-y-8">
      <MockDataBanner items={["All metrics", "Business data"]} />

      {/* Admin notice */}
      <div className="rounded-xl bg-violet-50 border border-violet-200 px-5 py-3 flex items-center gap-3">
        <span className="text-violet-500 text-lg">👁️</span>
        <p className="text-sm text-violet-800">
          <strong>Admin preview</strong> — this is exactly what your clients see on their dashboard. Uses mock data.
        </p>
      </div>

      {/* Client header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">Welcome back</p>
          <h1 className="text-2xl font-bold text-gray-900">{MOCK_BUSINESS.ownerName.split(" ")[0]} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {MOCK_BUSINESS.businessName} · {MOCK_BUSINESS.city} · {MOCK_BUSINESS.category}
          </p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 border border-green-200 text-xs font-bold px-3 py-1">
            ● Active Campaign
          </span>
          <p className="text-xs text-gray-400 mt-1">Next drop: {new Date(MOCK_BUSINESS.nextDrop).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</p>
        </div>
      </div>

      {/* Exclusivity banner */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 px-6 py-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium mb-1">🔒 Category Exclusive</p>
            <p className="text-lg font-bold leading-snug">
              You are the <span className="underline decoration-blue-300">only {MOCK_BUSINESS.category.toLowerCase()}</span> reaching homeowners in {MOCK_BUSINESS.city} this month.
            </p>
            <p className="text-blue-200 text-sm mt-1">No competitor can advertise on the same mailer.</p>
          </div>
          <div className="text-right shrink-0 ml-6">
            <p className="text-4xl font-black">{(MOCK_BUSINESS.homesPerMonth / 1000).toFixed(0)}K</p>
            <p className="text-blue-200 text-sm">homes / month</p>
          </div>
        </div>
      </div>

      {/* This month's stats */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">This Month</h2>
          <span className="text-xs text-gray-400">April 2026</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Homes Reached",   value: CURRENT.homesReached.toLocaleString(), prev: PREV.homesReached, icon: "📬", accent: "text-blue-600",   bg: "bg-blue-50",   note: "exclusive postcard drops" },
            { label: "QR Scans",        value: CURRENT.qrScans,                       prev: PREV.qrScans,      icon: "📱", accent: "text-purple-600", bg: "bg-purple-50", note: "people scanned your code" },
            { label: "Phone Calls",     value: CURRENT.calls,                         prev: PREV.calls,        icon: "📞", accent: "text-green-600",  bg: "bg-green-50",  note: "calls from your postcard" },
            { label: "Form Leads",      value: CURRENT.formLeads,                     prev: PREV.formLeads,    icon: "📋", accent: "text-amber-600",  bg: "bg-amber-50",  note: "contact forms submitted" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border border-gray-200 ${s.bg} p-5`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xl">{s.icon}</span>
                <TrendChip curr={Number(s.value.toString().replace(/,/g, ""))} prev={s.prev} />
              </div>
              <p className={`text-4xl font-black ${s.accent}`}>{s.value}</p>
              <p className="text-xs font-medium text-gray-500 mt-1">{s.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement bar chart */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Monthly Engagement</h2>
          <p className="text-xs text-gray-400 mt-0.5">QR scans + calls + form leads per month</p>
        </div>
        <div className="px-6 py-6">
          <div className="flex items-end gap-6 h-32">
            {MOCK_METRICS.map((m) => {
              const total = m.qrScans + m.calls + m.formLeads;
              const pct = Math.round((total / BAR_MAX) * 100);
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">{total}</span>
                  <div className="w-full rounded-t-lg bg-blue-500 transition-all" style={{ height: `${pct}%`, minHeight: "8px" }} />
                  <span className="text-xs text-gray-500">{m.monthLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lifetime totals */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Campaign Totals</h2>
          <p className="text-xs text-gray-400 mt-0.5">Since {new Date(MOCK_BUSINESS.startDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-100">
          {[
            { label: "Homes Reached",    value: totalHomesReached.toLocaleString(), color: "text-blue-600" },
            { label: "Total QR Scans",   value: totalQrScans,                       color: "text-purple-600" },
            { label: "Total Calls",      value: totalCalls,                         color: "text-green-600" },
            { label: "Total Form Leads", value: totalFormLeads,                     color: "text-amber-600" },
          ].map((s) => (
            <div key={s.label} className="px-6 py-5 text-center">
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ROI callout */}
      <div className="rounded-2xl border border-green-200 bg-green-50 px-6 py-5">
        <div className="flex items-start gap-4">
          <span className="text-3xl">💰</span>
          <div>
            <p className="font-bold text-green-900 text-lg">
              {totalActions} customer actions in {MOCK_METRICS.length} months
            </p>
            <p className="text-green-700 text-sm mt-1">
              If even <strong>1 in 10</strong> of those actions converts to a job at $500 average, that's{" "}
              <strong>${Math.round(totalActions * 0.1 * 500).toLocaleString()} in estimated revenue</strong> from a ${MOCK_BUSINESS.monthlyRate * MOCK_METRICS.length} investment.
            </p>
            <p className="text-xs text-green-600 mt-2">
              Estimates based on industry averages. Your results may vary.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
