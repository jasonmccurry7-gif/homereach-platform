import Link from "next/link";

const POLITICAL_PLAN_HREF = "/political/plan";
const POLITICAL_ACCOUNT_START_HREF = `/signup?redirect=${encodeURIComponent(POLITICAL_PLAN_HREF)}`;

interface PublicHeroProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryHref?: string;
  primaryLabel?: string;
  primaryRequiresAccount?: boolean;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function PublicHero({
  eyebrow,
  title,
  subtitle,
  primaryHref = POLITICAL_ACCOUNT_START_HREF,
  primaryLabel = "Start Campaign Mail Plan",
  primaryRequiresAccount = false,
  secondaryHref,
  secondaryLabel,
}: PublicHeroProps) {
  const resolvedPrimaryHref = primaryRequiresAccount
    ? `/signup?redirect=${encodeURIComponent(primaryHref)}`
    : primaryHref;

  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-slate-950">
      <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(30,64,175,0.34),rgba(15,23,42,0.92)_45%,rgba(127,29,29,0.32))]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-200">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
            {subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {resolvedPrimaryHref && (
              <Link
                href={resolvedPrimaryHref}
                className="rounded-lg bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500"
              >
                {primaryLabel}
              </Link>
            )}
            {secondaryHref && secondaryLabel && (
              <Link
                href={secondaryHref}
                className="rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
              >
                {secondaryLabel}
              </Link>
            )}
          </div>
        </div>
        <RouteVisual />
      </div>
    </section>
  );
}

export function CommandPanel({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-slate-950/30">
      <h2 className="text-lg font-black tracking-tight text-white">{title}</h2>
      {body && <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>}
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}

export function MetricBand({
  metrics,
}: {
  metrics: ReadonlyArray<{ label: string; value: string; detail: string }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => (
        <div
          key={metric.label}
          className="rounded-lg border border-white/10 bg-slate-900/80 p-4"
        >
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            {metric.label}
          </div>
          <div className={index === 1 ? "mt-2 text-3xl font-black text-red-200" : "mt-2 text-3xl font-black text-white"}>
            {metric.value}
          </div>
          <div className="mt-1 text-xs text-slate-400">{metric.detail}</div>
        </div>
      ))}
    </div>
  );
}

export function RouteVisual() {
  const routes = [
    {
      code: "HAM-01",
      area: "Hamilton west",
      households: "14.2k",
      status: "Ready",
      tone: "border-blue-300/40 bg-blue-500/20 text-blue-50",
      dot: "bg-blue-300",
    },
    {
      code: "HAM-02",
      area: "North suburbs",
      households: "11.8k",
      status: "Ready",
      tone: "border-blue-300/30 bg-blue-500/15 text-blue-50",
      dot: "bg-blue-300",
    },
    {
      code: "BUT-04",
      area: "Butler east",
      households: "8.9k",
      status: "Gap",
      tone: "border-red-300/40 bg-red-500/18 text-red-50",
      dot: "bg-red-300",
    },
    {
      code: "WAR-03",
      area: "Warren south",
      households: "7.4k",
      status: "Review",
      tone: "border-white/15 bg-white/8 text-slate-100",
      dot: "bg-slate-300",
    },
    {
      code: "CLE-02",
      area: "Clermont core",
      households: "9.6k",
      status: "Ready",
      tone: "border-blue-200/30 bg-blue-300/15 text-blue-50",
      dot: "bg-blue-200",
    },
    {
      code: "BUT-07",
      area: "Butler west",
      households: "6.1k",
      status: "Gap",
      tone: "border-red-300/35 bg-red-400/22 text-red-50",
      dot: "bg-red-300",
    },
    {
      code: "HAM-06",
      area: "Urban core",
      households: "12.7k",
      status: "Ready",
      tone: "border-blue-300/30 bg-blue-600/15 text-blue-50",
      dot: "bg-blue-300",
    },
    {
      code: "PRI-12",
      area: "High priority",
      households: "5.5k",
      status: "Priority",
      tone: "border-amber-200/40 bg-amber-300/18 text-amber-50",
      dot: "bg-amber-200",
    },
    {
      code: "WAR-08",
      area: "Outer ring",
      households: "4.8k",
      status: "Review",
      tone: "border-white/15 bg-white/8 text-slate-100",
      dot: "bg-slate-300",
    },
    {
      code: "HAM-09",
      area: "Count pending",
      households: "TBD",
      status: "Gap",
      tone: "border-red-300/30 bg-red-500/14 text-red-50",
      dot: "bg-red-300",
    },
    {
      code: "CLE-05",
      area: "River corridor",
      households: "10.4k",
      status: "Ready",
      tone: "border-blue-300/40 bg-blue-400/20 text-blue-50",
      dot: "bg-blue-300",
    },
    {
      code: "WAR-11",
      area: "Final QA",
      households: "6.9k",
      status: "Review",
      tone: "border-white/15 bg-white/8 text-slate-100",
      dot: "bg-slate-300",
    },
  ];

  const legend = [
    { label: "Ready", dot: "bg-blue-300" },
    { label: "Needs list", dot: "bg-red-300" },
    { label: "Priority", dot: "bg-amber-200" },
    { label: "Review", dot: "bg-slate-300" },
  ];

  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-2xl shadow-blue-950/30">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-200">
            Mail Coverage Model
          </div>
          <div className="mt-1 text-sm font-bold text-white">
            Example route readiness
          </div>
        </div>
        <div className="rounded-full border border-emerald-300/20 bg-emerald-950/50 px-3 py-1 text-xs font-bold text-emerald-200">
          Planning
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="font-bold uppercase tracking-[0.16em] text-slate-400">
          96,300 target households
        </div>
        <div className="flex flex-wrap gap-3 text-slate-300">
          {legend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${item.dot}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {routes.map((route) => (
          <div
            key={route.code}
            className={`min-h-20 rounded border p-2 shadow-inner ${route.tone}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-black">
                {route.code}
              </span>
              <span className={`h-2 w-2 shrink-0 rounded-full ${route.dot}`} />
            </div>
            <div className="mt-2 truncate text-xs font-bold">{route.area}</div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-300">
              <span>{route.households}</span>
              <span>{route.status}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded border border-white/10 bg-white/5 p-2 text-slate-200">
          <div className="font-mono text-lg font-black text-white">92%</div>
          target coverage
        </div>
        <div className="rounded border border-white/10 bg-white/5 p-2 text-slate-200">
          <div className="font-mono text-lg font-black text-white">3</div>
          routes need lists
        </div>
        <div className="rounded border border-white/10 bg-white/5 p-2 text-slate-200">
          <div className="font-mono text-lg font-black text-white">5d</div>
          mail window
        </div>
      </div>
    </div>
  );
}

export function TimelinePreview() {
  const steps = ["Approve", "Artwork", "Print", "Mail Drop", "In Home"];
  return (
    <div className="grid gap-3 sm:grid-cols-5">
      {steps.map((step, index) => (
        <div key={step} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-700 text-sm font-black text-white">
            {index + 1}
          </div>
          <div className="mt-3 text-sm font-bold text-white">{step}</div>
          <div className="mt-1 text-xs text-slate-400">
            {index === 0 ? "same day" : `+${index * 2} days`}
          </div>
        </div>
      ))}
    </div>
  );
}
