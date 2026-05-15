import {
  BarChart3,
  Building2,
  CheckCircle2,
  DollarSign,
  Home,
  MapPin,
  PackageCheck,
  Route,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
          {["Mailer stock", "Sign stakes", "Door hanger print"].map((item, index) => (
            <div key={item} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
              <span className="text-xs font-bold text-slate-600">{item}</span>
              <span className="text-xs font-black text-emerald-700">{[12, 18, 9][index]}%</span>
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
    <div className="rounded-lg border border-emerald-200 bg-white p-4 shadow-2xl shadow-emerald-950/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Inventory Intelligence
          </p>
          <h3 className="mt-1 text-xl font-black text-slate-950">Supplier savings dashboard</h3>
        </div>
        <DollarSign className="h-6 w-6 text-emerald-600" aria-hidden="true" />
      </div>
      <div className="mt-5 grid gap-3">
        {[
          ["Corrugated signs", "$3,480", "18% below last vendor"],
          ["Mailer stock", "$2,120", "12% buying opportunity"],
          ["Business card runs", "$870", "Bundle with next print"],
        ].map(([label, value, note]) => (
          <div key={label} className="grid grid-cols-[1fr_auto] gap-4 rounded-lg border border-slate-200 p-4">
            <div>
              <p className="font-black text-slate-950">{label}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{note}</p>
            </div>
            <p className="text-lg font-black text-emerald-700">{value}</p>
          </div>
        ))}
      </div>
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
