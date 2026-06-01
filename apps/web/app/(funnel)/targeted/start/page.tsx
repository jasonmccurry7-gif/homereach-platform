"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { TargetedTerritoryCommandVisual } from "@/components/marketing/homepage-visuals";

type RequestMode = "targeted_intake" | "quote_request";

type RequestContext = {
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  cityLabel: string;
  cityPlaceholder: string;
  submitLabel: string;
  footerNote: string;
  successTitle: string;
  successBody: string;
  noteTag: string;
  mode: RequestMode;
};

const DEFAULT_REQUEST_CONTEXT: RequestContext = {
  label: "Targeted neighborhood campaign",
  eyebrow: "Step 1 of 3",
  title: "Request a territory review.",
  description:
    "Tell us who you are and where you want more customers. HomeReach will guide the campaign setup before anything is charged or mailed.",
  cityLabel: "Primary city or service area",
  cityPlaceholder: "Austin, TX",
  submitLabel: "Continue to Campaign Builder",
  footerNote: "Your campaign stays human-reviewed before launch.",
  successTitle: "Territory review received",
  successBody:
    "HomeReach will review the request and prepare the next campaign step before anything is charged.",
  noteTag: "targeted-campaign",
  mode: "targeted_intake",
};

const PRODUCT_REQUEST_CONTEXTS = {
  "yard-signs": {
    label: "Yard signs",
    eyebrow: "Quick quote request",
    title: "Tell us where your signs need to show up.",
    description:
      "Share the basic business details now. HomeReach will confirm quantity, artwork, timing, and price before payment.",
    cityLabel: "City or campaign area",
    cityPlaceholder: "Medina, OH",
    submitLabel: "Request Yard Sign Quote",
    footerNote: "We will confirm the quote before any payment step.",
    successTitle: "Yard sign request received",
    successBody:
      "HomeReach will review the location, timing, and artwork needs, then follow up with a clear quote.",
    noteTag: "yard-signs",
    mode: "quote_request",
  },
  "door-hangers": {
    label: "Door hangers",
    eyebrow: "Quick quote request",
    title: "Tell us where the door hanger route should work.",
    description:
      "Share the basics so HomeReach can shape the route, quantity, design needs, and quote before production.",
    cityLabel: "City or neighborhood",
    cityPlaceholder: "Akron, OH",
    submitLabel: "Request Door Hanger Quote",
    footerNote: "We will confirm the route and quote before any payment step.",
    successTitle: "Door hanger request received",
    successBody:
      "HomeReach will review the area, quantity, and production needs, then follow up with the next clear step.",
    noteTag: "door-hangers",
    mode: "quote_request",
  },
  "business-cards": {
    label: "Business cards",
    eyebrow: "Quick quote request",
    title: "Tell us who needs the business cards.",
    description:
      "Send the core contact details now. HomeReach will confirm design needs, quantity, and quote before printing.",
    cityLabel: "City or service area",
    cityPlaceholder: "Cleveland, OH",
    submitLabel: "Request Business Card Quote",
    footerNote: "We will confirm design and quantity before any payment step.",
    successTitle: "Business card request received",
    successBody:
      "HomeReach will review the design and quantity needs, then follow up with a quote and next action.",
    noteTag: "business-cards",
    mode: "quote_request",
  },
} satisfies Record<string, RequestContext>;

type ProductKey = keyof typeof PRODUCT_REQUEST_CONTEXTS;

function getProductKey(value: string | null): ProductKey | null {
  if (!value) return null;
  return Object.prototype.hasOwnProperty.call(PRODUCT_REQUEST_CONTEXTS, value)
    ? (value as ProductKey)
    : null;
}

function buildLeadNotes(context: RequestContext, city: string) {
  return [
    `Requested product: ${context.label}`,
    `Lead capture path: ${context.noteTag}`,
    city.trim() ? `Initial area: ${city.trim()}` : null,
    "Approval note: quote/review required before payment, production, or outbound follow-up.",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function TargetedStartPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    phone: "",
    city: "",
    smsConsent: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productKey, setProductKey] = useState<ProductKey | null>(null);
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);

  const requestContext = productKey
    ? PRODUCT_REQUEST_CONTEXTS[productKey]
    : DEFAULT_REQUEST_CONTEXT;
  const isTargetedCampaign = requestContext.mode === "targeted_intake";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextProductKey = getProductKey(params.get("product"));
    const nextCity = params.get("city") ?? params.get("area");

    setProductKey(nextProductKey);
    if (nextCity) {
      setForm((prev) => (prev.city ? prev : { ...prev, city: nextCity }));
    }
  }, []);

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/targeted/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          businessName: form.businessName,
          email: form.email || undefined,
          phone: form.phone && form.smsConsent ? form.phone : undefined,
          city: form.city || undefined,
          source: "web",
          notes: buildLeadNotes(requestContext, form.city),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      if (requestContext.mode === "quote_request") {
        setQuoteSubmitted(true);
        setLoading(false);
        return;
      }

      const intakeParams = new URLSearchParams({ token: data.lead.intakeToken });
      if (productKey) intakeParams.set("product", productKey);
      router.push(`/targeted/intake?${intakeParams.toString()}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  if (quoteSubmitted) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-12 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-lg items-center">
          <div className="w-full rounded-lg border border-white/10 bg-white/[0.08] p-7 text-center shadow-2xl shadow-slate-950/20">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              Request captured
            </p>
            <h1 className="mt-3 text-2xl font-black">{requestContext.successTitle}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">{requestContext.successBody}</p>
            <div className="mt-6 rounded-lg border border-blue-300/20 bg-blue-400/10 px-4 py-3 text-left text-sm text-blue-50">
              <p className="font-bold">{form.businessName}</p>
              <p className="mt-1 text-blue-100">
                {form.city ? `${form.city} - ` : ""}
                {form.email}
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                href="/"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Back to HomeReach
              </Link>
              <Link
                href="/targeted/start"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500"
              >
                Start Mail Campaign
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-0 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative overflow-hidden px-4 py-8 sm:px-6 lg:flex lg:items-center lg:py-10">
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="relative w-full">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs">HR</span>
              HomeReach
            </Link>

            <div className="mt-12 max-w-2xl">
              <p className="inline-flex rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
                {requestContext.eyebrow}
              </p>
              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
                {requestContext.title}
              </h1>
              <p className="mt-5 text-base leading-8 text-slate-300">{requestContext.description}</p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { title: "No account yet", icon: Sparkles },
                { title: "Human review", icon: ShieldCheck },
                { title: isTargetedCampaign ? "Territory before payment" : "Quote before payment", icon: LockKeyhole },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-lg border border-white/10 bg-white/[0.08] p-3">
                    <Icon className="h-5 w-5 text-blue-200" aria-hidden="true" />
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-slate-300">
                      {item.title}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.08] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">
                    {isTargetedCampaign ? "Territory Preview" : "Quote Path"}
                  </p>
                  <p className="mt-1 text-lg font-black">
                    {isTargetedCampaign ? "Routes can be reviewed before checkout" : "Scope is confirmed before payment"}
                  </p>
                </div>
                <Clock3 className="h-5 w-5 text-blue-200" aria-hidden="true" />
              </div>
              <TargetedTerritoryCommandVisual mode="compact" className="mt-4" />
            </div>
          </div>
        </section>

        <section className="flex items-center px-4 py-8 sm:px-6 lg:py-10">
          <div className="w-full rounded-lg border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl shadow-slate-950/30 sm:p-6">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                {requestContext.label}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">Start with the essentials.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                HomeReach will use this to prepare the next guided step. No mass outreach, production, or launch happens without review.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Your name"
                  required
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={(value) => update("name", value)}
                  placeholder="Jane Smith"
                />
                <FormField
                  label="Business name"
                  required
                  type="text"
                  autoComplete="organization"
                  value={form.businessName}
                  onChange={(value) => update("businessName", value)}
                  placeholder="Peak Roofing Co."
                />
              </div>

              <FormField
                label="Email address"
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(value) => update("email", value)}
                placeholder="jane@peakroofing.com"
              />

              <div>
                <FormField
                  label="Phone number"
                  type="tel"
                  autoComplete="tel"
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

              <FormField
                label={requestContext.cityLabel}
                type="text"
                autoComplete="address-level2"
                value={form.city}
                onChange={(value) => update("city", value)}
                placeholder={requestContext.cityPlaceholder}
                helper="Optional, but it helps HomeReach prepare the right first recommendation."
              />

              <button
                type="submit"
                disabled={
                  loading ||
                  !form.name.trim() ||
                  !form.businessName.trim() ||
                  !form.email.trim() ||
                  (!!form.phone.trim() && !form.smsConsent)
                }
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-blue-950/20 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Preparing next step..." : requestContext.submitLabel}
                {!loading ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
              </button>

              <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-500">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <p>No spam. No credit card yet. {requestContext.footerNote}</p>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type,
  required = false,
  autoComplete,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type: string;
  required?: boolean;
  autoComplete?: string;
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
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}
