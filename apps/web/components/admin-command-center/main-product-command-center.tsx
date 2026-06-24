import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Brush,
  CheckCircle2,
  CloudLightning,
  CreditCard,
  Landmark,
  Mail,
  MessageSquareText,
  Palette,
  Phone,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wand2,
  Workflow,
  XCircle,
} from "lucide-react";
import type {
  ProductCommandData,
  ProductCommandMetric,
  ProductCommandProduct,
  ProductCommandReadiness,
} from "@/lib/admin/main-product-command";
import { cn } from "@/lib/utils";

const productIcons = {
  stormreach: CloudLightning,
  political: Landmark,
  targeted: Target,
} satisfies Record<ProductCommandProduct["key"], typeof CloudLightning>;

const accentClasses = {
  storm: {
    ring: "border-orange-300/30 bg-orange-300/10 text-orange-100",
    button: "bg-orange-500 text-slate-950 hover:bg-orange-400",
    icon: "bg-orange-500 text-slate-950",
  },
  political: {
    ring: "border-blue-300/30 bg-blue-300/10 text-blue-100",
    button: "bg-blue-500 text-white hover:bg-blue-400",
    icon: "bg-blue-500 text-white",
  },
  targeted: {
    ring: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    button: "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
    icon: "bg-emerald-500 text-slate-950",
  },
} satisfies Record<ProductCommandProduct["accent"], { ring: string; button: string; icon: string }>;

export function MainProductCommandCenter({ data }: { data: ProductCommandData }) {
  const blockedPayments = data.paymentReadiness.filter((item) => item.status === "blocked").length;
  const blockedTwilio = data.twilioReadiness.filter((item) => item.status === "blocked").length;

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <section className="border-b border-white/10 bg-[#07111f]">
        <div className="mx-auto grid max-w-[1540px] gap-6 px-4 py-7 sm:px-6 lg:px-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
                <Sparkles className="h-4 w-4" />
                Primary Revenue Command
              </div>
              <h1 className="mt-5 max-w-5xl text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Storms, campaigns, and targeted local growth in one operating system.
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-slate-300 sm:text-base">
                HomeReach is now organized around the three main products: StormReach, Political Campaigns, and
                Targeted Local Campaigns for dealerships, medical offices, dentists, and churches.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <TopAction href="/admin/stormreach" icon={CloudLightning} label="StormReach" />
                <TopAction href="/admin/political" icon={Landmark} label="Political" />
                <TopAction href="/admin/targeted-campaigns" icon={Target} label="Targeted" />
                <TopAction href="/admin/creative-studio" icon={Palette} label="Design Engine" />
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20">
              <ReadinessSummary
                icon={ShieldCheck}
                label="Human approval"
                value="Required before outbound sends, payment requests, pricing changes, publishing, ad launch, or fulfillment."
                ok
              />
              <ReadinessSummary
                icon={CreditCard}
                label="Payment paths"
                value={blockedPayments === 0 ? "Stripe readiness looks good." : `${blockedPayments} payment setup item${blockedPayments === 1 ? "" : "s"} need attention.`}
                ok={blockedPayments === 0}
              />
              <ReadinessSummary
                icon={Phone}
                label="Twilio SMS"
                value={blockedTwilio === 0 ? "SMS foundation is present." : `${blockedTwilio} SMS setup item${blockedTwilio === 1 ? "" : "s"} need attention.`}
                ok={blockedTwilio === 0}
              />
              <ReadinessSummary
                icon={Users}
                label="Admin access"
                value={`${data.teamAccess.adminUsers} admin user${data.teamAccess.adminUsers === 1 ? "" : "s"} visible. Brother access still needs approved credentials.`}
                ok={!data.teamAccess.sourceError}
              />
            </div>
          </div>

          {data.warnings.length > 0 ? (
            <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm font-semibold leading-6 text-amber-50">
              {data.warnings[0]}
            </div>
          ) : null}
        </div>
      </section>

      <div className="mx-auto grid max-w-[1540px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 xl:grid-cols-3">
          {data.products.map((product) => (
            <ProductCard key={product.key} product={product} />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
            <SectionHeader
              icon={Wand2}
              eyebrow="Design Engine"
              title="One creative studio, three product lanes"
              detail="Generate postcards, social graphics, landing copy, email, SMS, Messenger scripts, proposals, and one-page campaign briefs from one approval-first system."
            />
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <DesignLane
                title="StormReach"
                detail="Storm opportunity images, contractor campaign one-pagers, geofence graphics, and postcard follow-up copy."
                href="/admin/creative-studio"
                icon={CloudLightning}
              />
              <DesignLane
                title="Political"
                detail="Candidate mailers, route strategy visuals, neutral campaign explainers, and proposal creative."
                href="/admin/creative-studio"
                icon={Landmark}
              />
              <DesignLane
                title="Targeted"
                detail="Dealership, doctor, dentist, and church campaign assets with vertical-specific hooks and CTAs."
                href="/admin/creative-studio"
                icon={Target}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
            <SectionHeader
              icon={Workflow}
              eyebrow="Automation Outreach"
              title="Powerful, but controlled"
              detail="The system drafts and queues. You approve before anything leaves HomeReach."
            />
            <div className="mt-5 grid gap-3">
              <ChannelRow icon={Mail} label="Email" detail="Drafts, approval queue, provider send, unsubscribe handling." href="/admin/outreach-command" />
              <ChannelRow icon={MessageSquareText} label="SMS" detail="One-click phone SMS links and Twilio sends only when compliant." href="/admin/outreach-command" />
              <ChannelRow icon={BadgeCheck} label="Facebook Messenger" detail="Copy/open-link workflow. No automated Messenger blasting." href="/admin/facebook" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <ReadinessPanel title="Payment Paths" icon={CreditCard} items={data.paymentReadiness} />
          <ReadinessPanel title="Twilio / SMS" icon={Phone} items={data.twilioReadiness} />
          <ReadinessPanel title="Automation Guardrails" icon={ShieldCheck} items={data.automationReadiness} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
            <SectionHeader
              icon={Users}
              eyebrow="Team Access"
              title="Brother admin access"
              detail={data.teamAccess.brotherAccessNextStep}
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <WhiteMetric label="Total users" value={data.teamAccess.totalUsers.toString()} />
              <WhiteMetric label="Admins" value={data.teamAccess.adminUsers.toString()} />
              <WhiteMetric label="Sales agents" value={data.teamAccess.salesAgents.toString()} />
            </div>
            <div className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm font-semibold leading-6 text-amber-50">
              Send me his email, full name, and the temporary password you want used. I will create the Supabase Auth user with the same admin dashboard access level.
            </div>
            <Link
              href="/admin/users"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white px-4 text-sm font-black text-slate-950 transition hover:bg-slate-100"
            >
              Manage Users
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
            <SectionHeader
              icon={Brush}
              eyebrow="Premium Operating Focus"
              title="What the admin dashboard now pushes forward"
              detail="Every product has the same revenue path: find opportunity, draft outreach, generate creative, approve, collect payment, launch fulfillment, and track outcomes."
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                "StormReach: weather-triggered contractor campaigns.",
                "Political: geography-safe mail, proposal, payment, and fulfillment.",
                "Targeted: dealerships, doctors, dentists, churches, and local organizations.",
                "Design Engine: reusable creative generation across all three lanes.",
                "Outreach: email, SMS, and Messenger drafts with approval gates.",
                "Payments: Stripe checkout readiness visible before selling.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <p className="text-sm font-semibold leading-5 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ProductCard({ product }: { product: ProductCommandProduct }) {
  const Icon = productIcons[product.key];
  const accent = accentClasses[product.accent];

  return (
    <article className="flex min-h-[560px] flex-col rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div className={cn("inline-flex h-12 w-12 items-center justify-center rounded-lg", accent.icon)}>
          <Icon className="h-6 w-6" />
        </div>
        <span className={cn("rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]", accent.ring)}>
          Main product
        </span>
      </div>
      <h2 className="mt-5 text-2xl font-black tracking-tight text-white">{product.title}</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{product.description}</p>
      <p className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        {product.audience}
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {product.metrics.map((metric) => (
          <MetricTile key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="mt-5 grid gap-4">
        <ListBlock title="Automation" items={product.automation} />
        <ListBlock title="Design presets" items={product.designPresets} />
      </div>

      <div className="mt-auto pt-5">
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm font-semibold leading-6 text-cyan-50">
          {product.paymentPath}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={product.href}
            className={cn("inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-black transition", accent.button)}
          >
            {product.primaryAction}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={product.secondaryHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white transition hover:bg-white hover:text-slate-950"
          >
            {product.secondaryAction}
          </Link>
        </div>
      </div>
    </article>
  );
}

function TopAction({ href, icon: Icon, label }: { href: string; icon: typeof CloudLightning; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white transition hover:bg-white hover:text-slate-950"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function MetricTile({ metric }: { metric: ProductCommandMetric }) {
  const tone = {
    good: "border-emerald-300/20 bg-emerald-300/10 text-emerald-50",
    watch: "border-amber-300/20 bg-amber-300/10 text-amber-50",
    danger: "border-rose-300/20 bg-rose-300/10 text-rose-50",
    neutral: "border-white/10 bg-black/20 text-slate-100",
  }[metric.tone];

  return (
    <div className={cn("rounded-lg border p-3", tone)}>
      <p className="text-2xl font-black text-white">{metric.value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">{metric.label}</p>
      <p className="mt-1 text-xs font-semibold leading-4 text-slate-300">{metric.detail}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <div className="mt-2 grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 text-sm font-semibold leading-5 text-slate-300">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  detail,
}: {
  icon: typeof Wand2;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-100">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-white">{title}</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{detail}</p>
      </div>
    </div>
  );
}

function DesignLane({
  title,
  detail,
  href,
  icon: Icon,
}: {
  title: string;
  detail: string;
  href: string;
  icon: typeof CloudLightning;
}) {
  return (
    <Link href={href} className="group rounded-lg border border-white/10 bg-black/20 p-4 transition hover:border-cyan-300/40 hover:bg-cyan-300/10">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-5 w-5 text-cyan-100" />
        <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:text-cyan-100" />
      </div>
      <h3 className="mt-4 text-lg font-black text-white">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{detail}</p>
    </Link>
  );
}

function ChannelRow({
  icon: Icon,
  label,
  detail,
  href,
}: {
  icon: typeof Mail;
  label: string;
  detail: string;
  href: string;
}) {
  return (
    <Link href={href} className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-3 transition hover:border-cyan-300/40 hover:bg-cyan-300/10">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-cyan-100" />
      <div>
        <p className="text-sm font-black text-white">{label}</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-slate-300">{detail}</p>
      </div>
    </Link>
  );
}

function ReadinessPanel({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof CreditCard;
  items: ProductCommandReadiness[];
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-cyan-100" />
        <h2 className="text-lg font-black text-white">{title}</h2>
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <ReadinessItem key={item.key} item={item} />
        ))}
      </div>
    </section>
  );
}

function ReadinessItem({ item }: { item: ProductCommandReadiness }) {
  const Icon = item.status === "ready" ? CheckCircle2 : item.status === "blocked" ? XCircle : ShieldCheck;
  const tone =
    item.status === "ready"
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
      : item.status === "blocked"
        ? "border-rose-300/25 bg-rose-300/10 text-rose-50"
        : "border-amber-300/25 bg-amber-300/10 text-amber-50";
  const content = (
    <div className={cn("rounded-lg border p-3", tone)}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-sm font-black text-white">{item.label}</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-200">{item.detail}</p>
        </div>
      </div>
    </div>
  );
  return item.route ? <Link href={item.route}>{content}</Link> : content;
}

function ReadinessSummary({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
      <div className={cn("mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", ok ? "bg-emerald-400 text-slate-950" : "bg-amber-300 text-slate-950")}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-black text-white">{label}</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-slate-300">{value}</p>
      </div>
    </div>
  );
}

function WhiteMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white p-3 text-slate-950">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
    </div>
  );
}
