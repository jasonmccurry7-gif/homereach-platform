"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  MapPinned,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { TargetedTerritoryCommandVisual } from "@/components/marketing/homepage-visuals";
import {
  formatTargetedCampaignDollars,
  getTargetedCampaignTotalCents,
  TARGETED_CAMPAIGN_PLAYBOOKS,
  TARGETED_PRICING_TIERS,
  type TargetedPricingTier,
} from "@/lib/targeted/pricing";

const ClientSuspense = Suspense as unknown as (props: {
  fallback: React.ReactNode;
  children: React.ReactNode;
}) => React.ReactNode;

const DEFAULT_PRICING_TIER =
  TARGETED_PRICING_TIERS.find((tier) => tier.popular) ?? TARGETED_PRICING_TIERS[0];

type OrgType = "business" | "nonprofit";

function IntakeFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? undefined;

  const [selectedTier, setSelectedTier] = useState<TargetedPricingTier>(DEFAULT_PRICING_TIER);
  const [orgType, setOrgType] = useState<OrgType>("business");
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    smsConsent: false,
    businessAddress: "",
    targetCity: "",
    targetAreaNotes: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = getTargetedCampaignTotalCents(selectedTier);
  const formattedTotal = formatTargetedCampaignDollars(total);
  const activePlaybook = useMemo(
    () =>
      TARGETED_CAMPAIGN_PLAYBOOKS.find((playbook) => playbook.packageHomes === selectedTier.homes) ??
      TARGETED_CAMPAIGN_PLAYBOOKS[0],
    [selectedTier.homes],
  );

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function buildInternalNotes() {
    return [
      `Selected package: ${selectedTier.label}`,
      `Package purpose: ${selectedTier.purpose}`,
      `AI playbook cue: ${activePlaybook?.title ?? "Standard route review"}`,
      form.notes.trim() ? `Customer notes: ${form.notes.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/targeted/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakeToken: token,
          businessName: form.businessName,
          contactName: form.contactName || undefined,
          email: form.email,
          phone: form.phone && form.smsConsent ? form.phone : undefined,
          businessAddress: form.businessAddress || undefined,
          targetCity: form.targetCity || undefined,
          targetAreaNotes: form.targetAreaNotes,
          notes: buildInternalNotes(),
          homesCount: selectedTier.homes,
          priceCents: total,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      if (orgType === "nonprofit") {
        const params = new URLSearchParams({
          ...(form.businessName && { orgName: form.businessName }),
          ...(form.contactName && { contactName: form.contactName }),
          ...(form.email && { email: form.email }),
          ...(form.phone && form.smsConsent && { phone: form.phone }),
          ...(form.targetCity && { city: form.targetCity }),
        });
        router.push(`/nonprofit?${params.toString()}`);
        return;
      }

      const checkoutParam = data.checkoutToken
        ? `token=${encodeURIComponent(data.checkoutToken)}`
        : `campaign=${encodeURIComponent(data.campaign.id)}`;
      router.push(`/targeted/checkout?${checkoutParam}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm font-black">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs">HR</span>
            HomeReach
          </Link>
          <span className="hidden rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-100 sm:inline-flex">
            Step 2 of 3
          </span>
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-6 lg:py-8">
        <section className="space-y-5">
          <div className="rounded-lg border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-blue-950/10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">
              Campaign Command
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Choose the territory package. HomeReach handles the complexity.
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              This builder recommends a campaign size, confirms homeowner reach, keeps pricing visible, and preserves
              human review before production, mailing, or customer-facing claims.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: "AI package fit", value: selectedTier.shortLabel, icon: Sparkles },
                { label: "Homeowner reach", value: selectedTier.homes.toLocaleString(), icon: UsersRound },
                { label: "Launch gate", value: "Approval", icon: ShieldCheck },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-lg border border-white/10 bg-white/10 p-3">
                    <Icon className="h-5 w-5 text-blue-200" aria-hidden="true" />
                    <p className="mt-3 text-lg font-black">{item.value}</p>
                    <p className="text-xs font-semibold text-slate-400">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.08] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">
                  Territory Preview
                </p>
                <p className="mt-1 text-lg font-black">{selectedTier.neighborhoods}</p>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-200">
                {selectedTier.visibilityImpact}
              </span>
            </div>
            <TargetedTerritoryCommandVisual mode="compact" className="mt-4" />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                ["Timeline", "10-14 days after approval"],
                ["Creative", "Preview before mail"],
                ["Price", `${formattedTotal} total`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
                  <p className="mt-2 text-sm font-black text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl shadow-slate-950/20">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                      Recommended Packages
                    </p>
                    <h2 className="mt-2 text-2xl font-black">Select your market move.</h2>
                  </div>
                  <p className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                    Design + print + postage included
                  </p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {TARGETED_PRICING_TIERS.map((tier) => {
                    const isSelected = tier.homes === selectedTier.homes;
                    return (
                      <button
                        key={tier.homes}
                        type="button"
                        onClick={() => setSelectedTier(tier)}
                        aria-pressed={isSelected}
                        className={`min-h-56 rounded-lg border p-4 text-left transition ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600 ring-offset-2"
                            : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-black text-slate-950">{tier.label}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{tier.purpose}</p>
                          </div>
                          {tier.popular ? (
                            <span className="rounded-full bg-blue-700 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                              Recommended
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <PackageMetric label="Homes" value={tier.homes.toLocaleString()} />
                          <PackageMetric
                            label="Total"
                            value={formatTargetedCampaignDollars(getTargetedCampaignTotalCents(tier))}
                          />
                          <PackageMetric label="Frequency" value={tier.frequency} />
                          <PackageMetric label="Routes" value={tier.neighborhoods} />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {tier.recommendedFor.slice(0, 4).map((category) => (
                            <span
                              key={category}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-600"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                    <div>
                      <p className="font-black text-blue-950">
                        AI recommendation: {activePlaybook?.title ?? selectedTier.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-blue-800">
                        {activePlaybook?.signal ?? selectedTier.strategy} HomeReach will verify route fit before launch.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200" />

              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Organization
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                  {([
                    { value: "business", label: "Business", icon: Building2 },
                    { value: "nonprofit", label: "Nonprofit", icon: ShieldCheck },
                  ] as const).map((opt) => {
                    const Icon = opt.icon;
                    const active = orgType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setOrgType(opt.value)}
                        className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-black transition ${
                          active ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-950"
                        }`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {orgType === "nonprofit" && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                    <p className="font-black">Nonprofit pricing requires verification.</p>
                    <p className="mt-0.5 text-xs leading-5">
                      After this form, HomeReach will route you through verification before any discounted pricing is applied.
                    </p>
                  </div>
                )}

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Business name"
                    required
                    value={form.businessName}
                    onChange={(value) => update("businessName", value)}
                    placeholder="Peak Roofing Co."
                  />
                  <FormField
                    label="Your name"
                    value={form.contactName}
                    onChange={(value) => update("contactName", value)}
                    placeholder="Jane Smith"
                  />
                  <FormField
                    label="Email"
                    required
                    type="email"
                    value={form.email}
                    onChange={(value) => update("email", value)}
                    placeholder="jane@peakroofing.com"
                  />
                  <div>
                    <FormField
                      label="Phone"
                      type="tel"
                      value={form.phone}
                      onChange={(value) => update("phone", value)}
                      placeholder="(512) 555-0100"
                      helper="Optional. Required only if you want text updates."
                    />
                    <label className="mt-2 flex gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                      <input
                        type="checkbox"
                        checked={form.smsConsent}
                        onChange={(e) => update("smsConsent", e.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                      />
                      <span>
                        I agree HomeReach may text me about this request, including campaign information, quote follow-up,
                        appointment coordination, proposal/order updates, and support replies. Message frequency varies.
                        Msg and data rates may apply. Reply HELP for help or STOP to opt out. SMS consent is not required
                        as a condition of purchase. Mobile opt-in data will not be shared with third parties or affiliates
                        for marketing or promotional purposes. See{" "}
                        <Link href="/terms" className="font-semibold text-blue-700 underline">Terms</Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="font-semibold text-blue-700 underline">Privacy Policy</Link>.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200" />

              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Territory
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Business address"
                    value={form.businessAddress}
                    onChange={(value) => update("businessAddress", value)}
                    placeholder="123 Main St, Austin, TX"
                    helper="Optional. Helps shape a radius or nearby route plan."
                  />
                  <FormField
                    label="City or ZIP"
                    value={form.targetCity}
                    onChange={(value) => update("targetCity", value)}
                    placeholder="Austin, TX or 78701"
                    helper="Optional, but recommended for faster review."
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-bold text-slate-800">
                    Where do you want more customers? <span className="text-red-500">*</span>
                  </label>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Use plain language. Neighborhoods, ZIPs, service radius, storm areas, or competitor-heavy pockets all work.
                  </p>
                  <textarea
                    required
                    rows={4}
                    value={form.targetAreaNotes}
                    onChange={(e) => update("targetAreaNotes", e.target.value)}
                    placeholder="Example: Homeowners within 2 miles of our shop, especially the newer subdivisions west of Main Street."
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-bold text-slate-800">
                    Campaign notes <span className="text-xs font-medium text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    placeholder="Example: We want spring HVAC tune-ups, fast scheduling, and a clean premium feel."
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    { label: "Area", value: selectedTier.neighborhoods, icon: MapPinned },
                    { label: "Reach", value: `${selectedTier.homes.toLocaleString()} homes`, icon: UsersRound },
                    { label: "Launch", value: "After approval", icon: Clock3 },
                    { label: "Due at checkout", value: formattedTotal, icon: LockKeyhole },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label}>
                        <Icon className="h-4 w-4 text-blue-700" aria-hidden="true" />
                        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-950">{item.value}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  loading ||
                  !form.businessName.trim() ||
                  !form.email.trim() ||
                  !form.targetAreaNotes.trim()
                }
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-blue-950/20 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Preparing checkout path..."
                  : orgType === "nonprofit"
                    ? "Submit and verify nonprofit pricing"
                    : `Continue to secure launch path - ${formattedTotal}`}
                {!loading ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
              </button>

              <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-500">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <p>
                  You will review checkout before payment. HomeReach still reviews creative, route notes, and launch readiness before anything mails.
                </p>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

function PackageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
  helper?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-800">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {helper ? <p className="mt-0.5 text-xs text-slate-500">{helper}</p> : null}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

export default function TargetedIntakePage() {
  return (
    <ClientSuspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <p className="text-sm font-semibold text-slate-300">Loading campaign builder...</p>
        </div>
      }
    >
      <IntakeFormInner />
    </ClientSuspense>
  );
}
