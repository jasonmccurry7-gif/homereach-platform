import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  Gauge,
  Home,
  LockKeyhole,
  MapPin,
  PackageCheck,
  Radar,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const purchasingQueueItems = [
  { label: "Takeout containers", variance: "18% gap" },
  { label: "Nitrile gloves", variance: "12% gap" },
  { label: "Cleaning chemicals", variance: "9% gap" },
];

const purchasingSavingsRows = [
  {
    label: "Takeout containers & lids",
    value: "$3,480",
    spend: "monthly spend",
    note: "18% landed-cost variance to review",
    status: "Quote example",
  },
  {
    label: "Nitrile gloves & liners",
    value: "$2,120",
    spend: "monthly spend",
    note: "12% supplier variance flagged",
    status: "Review pricing",
  },
  {
    label: "Cleaning chemicals",
    value: "$870",
    spend: "monthly spend",
    note: "Reorder window opens this week",
    status: "Reorder risk",
  },
];

const territoryMetrics = [
  { label: "Homeowner reach", value: "2,500", tone: "text-blue-100" },
  { label: "Route clusters", value: "4", tone: "text-emerald-100" },
  { label: "Review gate", value: "Human", tone: "text-amber-100" },
  { label: "Launch path", value: "10-14d", tone: "text-red-100" },
];

const territoryCommandRows = [
  {
    label: "Recommended plan",
    value: "High-Value Homeowner Reach",
    detail: "Broad homeowner visibility without forcing route math.",
    icon: Sparkles,
    tone: "bg-blue-500/15 text-blue-100 ring-blue-300/20",
  },
  {
    label: "Protected category",
    value: "Review required",
    detail: "Conflict checks stay approval-first before launch.",
    icon: LockKeyhole,
    tone: "bg-amber-500/15 text-amber-100 ring-amber-300/20",
  },
  {
    label: "Territory risk",
    value: "Limited capacity",
    detail: "Availability depends on timing, category, and route load.",
    icon: Radar,
    tone: "bg-red-500/15 text-red-100 ring-red-300/20",
  },
  {
    label: "Next action",
    value: "Secure review",
    detail: "Start the guided builder with no payment on step one.",
    icon: ShieldCheck,
    tone: "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20",
  },
];

const territoryMapLabels = [
  { label: "Priority route", position: "left-[12%] top-[22%]", tone: "bg-blue-500 text-white" },
  { label: "Protected review", position: "right-[13%] top-[30%]", tone: "bg-amber-400 text-slate-950" },
  { label: "Expansion pocket", position: "left-[36%] bottom-[18%]", tone: "bg-emerald-400 text-slate-950" },
  { label: "Competitive pressure", position: "right-[8%] bottom-[23%]", tone: "bg-red-500 text-white" },
];

export function TargetedTerritoryCommandVisual({
  className,
  mode = "full",
}: {
  className?: string;
  mode?: "full" | "compact";
}) {
  const compact = mode === "compact";

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-lg border border-white/10 bg-slate-950 p-4 text-white shadow-2xl shadow-blue-950/20",
        className
      )}
    >
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-blue-600/20 to-transparent" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">
              Territory Command
            </p>
            <h3 className="mt-1 text-xl font-black tracking-tight text-white">
              Neighborhood acquisition plan ready for review
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "AI assisted", icon: Sparkles },
              { label: "Approval-first", icon: ShieldCheck },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-blue-100"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className={cn("mt-4 grid gap-4", compact ? "lg:grid-cols-1" : "lg:grid-cols-[1.18fr_0.82fr]")}>
          <div className="relative min-h-[21rem] overflow-hidden rounded-lg border border-white/10 bg-slate-900">
            <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(255,255,255,.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.09)_1px,transparent_1px)] [background-size:28px_28px]" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 520 340" fill="none">
              <path
                d="M38 276 C92 180 128 242 186 162 C236 92 306 144 486 48"
                stroke="#38bdf8"
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity=".85"
              />
              <path
                d="M72 86 C142 48 208 76 250 132 C310 212 372 216 476 162"
                stroke="#ef4444"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="16 14"
                strokeOpacity=".72"
              />
              <path
                d="M92 246 L190 188 L308 206 L398 130 L462 180 L342 284 L190 292 Z"
                fill="#2563eb"
                fillOpacity=".14"
                stroke="#60a5fa"
                strokeWidth="2"
                strokeDasharray="9 8"
              />
              <path
                d="M118 74 L222 48 L306 94 L262 170 L142 158 Z"
                fill="#10b981"
                fillOpacity=".16"
                stroke="#6ee7b7"
                strokeWidth="2"
              />
              <path
                d="M320 72 L454 34 L492 120 L404 166 L326 134 Z"
                fill="#f59e0b"
                fillOpacity=".16"
                stroke="#fcd34d"
                strokeWidth="2"
              />
            </svg>
            {territoryMapLabels.map((item) => (
              <span
                key={item.label}
                className={cn(
                  "absolute rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] shadow-xl",
                  item.position,
                  item.tone
                )}
              >
                {item.label}
              </span>
            ))}
            <div className="absolute bottom-3 left-3 right-3 grid gap-2 sm:grid-cols-3">
              {[
                { label: "Homeowner density", value: "High", icon: UsersRound },
                { label: "Route fit", value: "A-", icon: Gauge },
                { label: "Mail readiness", value: "Review", icon: Activity },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-lg border border-white/10 bg-slate-950/70 p-2 backdrop-blur">
                    <Icon className="h-4 w-4 text-blue-200" aria-hidden="true" />
                    <p className="mt-1 text-xs font-black text-white">{item.value}</p>
                    <p className="text-[10px] font-semibold text-slate-400">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={cn("grid gap-3", compact ? "sm:grid-cols-2" : "")}>
            {territoryCommandRows.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.08] p-3">
                  <div className="flex items-start gap-3">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1", item.tone)}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-1 break-words text-sm font-black text-white">{item.value}</p>
                      {!compact ? (
                        <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {territoryMetrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-white/10 bg-white/[0.08] p-3">
              <p className={cn("text-xl font-black", metric.tone)}>{metric.value}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {metric.label}
              </p>
            </div>
          ))}
        </div>

        {!compact ? (
          <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
            {[
              { label: "Choose Area", icon: Target },
              { label: "Approve Plan", icon: CheckCircle2 },
              { label: "Launch Timeline", icon: CalendarClock },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center gap-2 text-sm font-black text-slate-200">
                  <Icon className="h-4 w-4 text-blue-200" aria-hidden="true" />
                  {step.label}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function HeroPlatformVisual() {
  return (
    <div className="relative mx-auto min-h-[34rem] w-full max-w-xl lg:max-w-none">
      <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_32%_20%,rgba(59,130,246,.34),transparent_28%),linear-gradient(135deg,rgba(15,23,42,.96),rgba(15,23,42,.72))] shadow-2xl shadow-blue-950/30 ring-1 ring-white/10" />
      <div className="absolute left-5 right-5 top-5 rounded-lg border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
              Geographic Command
            </p>
            <p className="mt-1 text-lg font-black text-white">Route intelligence live</p>
          </div>
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-200">
            18.4% saved
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1.35fr_0.65fr]">
          <RouteMapPanel />
          <div className="grid gap-3">
            <MetricTile label="Campaign reach" value="42,880" tone="blue" />
            <MetricTile label="Supplier variance" value="$14.2k" tone="green" />
            <MetricTile label="Political drops" value="5 waves" tone="red" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-4 w-[52%] rounded-lg border border-white/10 bg-white p-4 text-slate-950 shadow-2xl shadow-slate-950/30">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Shared Postcard
          </p>
          <PackageCheck className="h-4 w-4 text-blue-600" aria-hidden="true" />
        </div>
        <div className="mt-4 aspect-[1.65] rounded-md bg-[linear-gradient(135deg,#eff6ff,#ffffff_50%,#fee2e2)] p-3 ring-1 ring-slate-200">
          <div className="h-3 w-16 rounded bg-blue-600" />
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="h-12 rounded bg-slate-900" />
            <div className="space-y-2">
              <div className="h-2 rounded bg-slate-300" />
              <div className="h-2 rounded bg-slate-200" />
              <div className="h-2 w-2/3 rounded bg-red-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 right-4 w-[50%] rounded-lg border border-emerald-200 bg-white p-4 text-slate-950 shadow-2xl shadow-slate-950/30">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <TrendingDown className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              Purchasing
            </p>
            <p className="text-sm font-black">Savings queue</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {purchasingQueueItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
              <span className="text-xs font-bold text-slate-600">{item.label}</span>
              <span className="text-xs font-black text-emerald-700">{item.variance}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RouteMapPanel({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative min-h-[14rem] overflow-hidden rounded-lg border border-white/10 bg-slate-950",
        className
      )}
    >
      <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,.10)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.10)_1px,transparent_1px)] [background-size:34px_34px]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 220" fill="none">
        <path
          d="M22 172 C72 104 116 190 164 126 C205 72 252 104 336 42"
          stroke="#38bdf8"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity=".88"
        />
        <path
          d="M40 64 C92 38 132 56 160 92 C198 142 246 150 316 116"
          stroke="#ef4444"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="12 12"
          strokeOpacity=".72"
        />
      </svg>
      {[
        ["left-[18%] top-[30%]", "2.4k"],
        ["left-[45%] top-[51%]", "5.8k"],
        ["left-[73%] top-[24%]", "9.1k"],
      ].map(([position, label]) => (
        <span
          key={position}
          className={cn(
            "absolute flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.12] px-2 py-1 text-[10px] font-black text-white backdrop-blur",
            position
          )}
        >
          <MapPin className="h-3 w-3 text-blue-200" aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}

export function IntelligenceVisual() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-950/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Property Intelligence
          </p>
          <h3 className="mt-1 text-xl font-black text-slate-950">Targeting overlays</h3>
        </div>
        <Building2 className="h-6 w-6 text-blue-600" aria-hidden="true" />
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <RouteMapPanel className="min-h-[18rem] border-slate-200 bg-slate-900" />
        <div className="space-y-3">
          {[
            ["Owner occupied", "82%", "bg-blue-50 text-blue-700"],
            ["High equity", "41%", "bg-emerald-50 text-emerald-700"],
            ["Route fit", "A-", "bg-red-50 text-red-700"],
            ["Mail readiness", "Ready", "bg-amber-50 text-amber-700"],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                {label}
              </p>
              <p className={cn("mt-2 inline-flex rounded-md px-2 py-1 text-sm font-black", tone)}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CampaignOpsVisual({ tone = "blue" }: { tone?: "blue" | "red" | "green" }) {
  const accent =
    tone === "red" ? "text-red-600 bg-red-50" : tone === "green" ? "text-emerald-600 bg-emerald-50" : "text-blue-600 bg-blue-50";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-950/10">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Plan", icon: Route },
          { label: "Approve", icon: CheckCircle2 },
          { label: "Measure", icon: BarChart3 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-slate-200 p-3">
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accent)}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-black text-slate-950">{item.label}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-lg bg-slate-950 p-4 text-white">
        <RouteMapPanel className="min-h-[14rem] border-white/10" />
      </div>
    </div>
  );
}

export function PurchasingVisual() {
  return (
    <div className="w-full min-w-0 max-w-full rounded-lg border border-emerald-200 bg-white p-4 shadow-2xl shadow-emerald-950/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Example Review Queue
          </p>
          <h3 className="mt-1 text-xl font-black text-slate-950">Supplier savings review queue</h3>
        </div>
        <DollarSign className="h-6 w-6 text-emerald-600" aria-hidden="true" />
      </div>
      <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["$6,470", "spend under review"],
          ["3", "actions pending review"],
          ["18%", "top variance"],
        ].map(([value, label]) => (
          <div key={label} className="min-w-0 rounded-lg bg-emerald-50 px-3 py-2">
            <p className="text-lg font-black text-emerald-800">{value}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
              {label}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3">
        {purchasingSavingsRows.map((row) => (
          <div key={row.label} className="rounded-lg border border-slate-200 p-4">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="break-words font-black text-slate-950">{row.label}</p>
                <p className="mt-1 break-words text-xs font-semibold text-slate-500">{row.note}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-lg font-black text-emerald-700">{row.value}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {row.spend}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Owner review</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{row.status}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-500">
        Examples stay focused on recurring operating supplies, not one-off print products.
      </p>
    </div>
  );
}

export function PrintProductVisual() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        ["Yard signs", "Campaign visibility", "bg-blue-600"],
        ["Door hangers", "Neighborhood saturation", "bg-red-600"],
        ["Business cards", "Premium handoff", "bg-slate-950"],
      ].map(([title, subtitle, tone]) => (
        <div key={title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className={cn("flex aspect-[1.45] items-center justify-center rounded-md text-white", tone)}>
            <Home className="h-10 w-10" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
        </div>
      ))}
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-200"
      : tone === "red"
      ? "text-red-200"
      : "text-blue-200";

  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-3">
      <p className={cn("text-lg font-black", toneClass)}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-300">{label}</p>
    </div>
  );
}
