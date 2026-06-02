"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BadgeDollarSign,
  Bot,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tags,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sharedPostcardEmotionCopy } from "@/lib/brand/emotional-positioning";
import type {
  AiCartItemView,
  AiIntakeCategoryOption,
  AiIntakeCityOption,
  AiIntakeState,
  AiMessageView,
  AiPlacementType,
} from "@/lib/ai-intake/shared-postcard-cart";

type Options = {
  cities: AiIntakeCityOption[];
  categories: AiIntakeCategoryOption[];
};

type AgentState = AiIntakeState & { options: Options };

type DetailsForm = {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  smsConsent: boolean;
  websiteUrl: string;
  facebookUrl: string;
  logoUrl: string;
  logoFileName: string;
  offerHeadline: string;
  aiGenerateOffer: boolean;
};

const placements: Array<{
  id: AiPlacementType;
  label: string;
  body: string;
}> = [
  { id: "front", label: "Front spot", body: "Premium visibility for the offer you want remembered first." },
  { id: "back", label: "Back spot", body: "Efficient exposure that keeps local visibility affordable." },
  { id: "multiple", label: "Multiple spots", body: "Reserve more room when one message is not enough." },
  { id: "full_card_exclusivity", label: "Full-card exclusivity", body: "Hold the remaining card when category control matters most." },
];

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function initialDetails(): DetailsForm {
  return {
    businessName: "",
    contactName: "",
    phone: "",
    email: "",
    smsConsent: false,
    websiteUrl: "",
    facebookUrl: "",
    logoUrl: "",
    logoFileName: "",
    offerHeadline: "",
    aiGenerateOffer: false,
  };
}

export function AiIntakeAgentClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSessionId = searchParams?.get("sessionId") ?? undefined;
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [placementType, setPlacementType] = useState<AiPlacementType>("back");
  const [quantity, setQuantity] = useState(1);
  const [militaryEligible, setMilitaryEligible] = useState(false);
  const [details, setDetails] = useState<DetailsForm>(initialDetails);
  const [busyAction, setBusyAction] = useState<string | null>("bootstrap");
  const [error, setError] = useState<string | null>(null);

  const session = agentState?.session ?? null;
  const cartItems = agentState?.cartItems ?? [];
  const options = agentState?.options ?? { cities: [], categories: [] };

  const selectedCities = useMemo(
    () => options.cities.filter((city) => selectedCityIds.includes(city.id)),
    [options.cities, selectedCityIds],
  );
  const selectedCategories = useMemo(
    () => options.categories.filter((category) => selectedCategoryIds.includes(category.id)),
    [options.categories, selectedCategoryIds],
  );

  async function callAgent(payload: Record<string, unknown>, actionName: string) {
    setBusyAction(actionName);
    setError(null);
    try {
      const res = await fetch("/api/ai-intake/shared-postcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.status === 401 && data.redirectTo) {
        router.push(data.redirectTo);
        return null;
      }

      if (!res.ok) {
        setError(data.error ?? "The intake agent could not complete that action.");
        return null;
      }

      if (data.session) {
        setAgentState(data as AgentState);
        const newSessionId = data.session.id as string;
        if (!requestedSessionId || requestedSessionId !== newSessionId) {
          router.replace(`/shared-postcards/ai-intake?sessionId=${newSessionId}`);
        }
      }

      return data;
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const res = await fetch("/api/ai-intake/shared-postcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bootstrap", sessionId: requestedSessionId }),
      });
      const data = await res.json();
      if (!mounted) return;
      setBusyAction(null);
      if (!res.ok) {
        setError(data.error ?? "AI intake is not available right now.");
        return;
      }
      setAgentState(data as AgentState);
      if (!requestedSessionId && data.session?.id) {
        router.replace(`/shared-postcards/ai-intake?sessionId=${data.session.id}`);
      }
    }

    bootstrap().catch((err) => {
      if (!mounted) return;
      setBusyAction(null);
      setError(err instanceof Error ? err.message : "AI intake is not available right now.");
    });

    return () => {
      mounted = false;
    };
  }, [requestedSessionId, router]);

  useEffect(() => {
    if (!session) return;
    setDetails({
      businessName: session.businessName,
      contactName: session.contactName,
      phone: session.phone,
      email: session.email,
      smsConsent: false,
      websiteUrl: session.websiteUrl,
      facebookUrl: session.facebookUrl,
      logoUrl: session.logoUrl,
      logoFileName: session.logoFileName,
      offerHeadline: session.offerHeadline,
      aiGenerateOffer: session.aiGenerateOffer,
    });
    setMilitaryEligible(session.militaryDiscountEligible);
  }, [session?.id]);

  async function addToCart() {
    if (!session) return;
    if (selectedCityIds.length === 0 || selectedCategoryIds.length === 0) {
      setError("Pick at least one city and one category.");
      return;
    }
    await callAgent(
      {
        action: "add_item",
        sessionId: session.id,
        cityIds: selectedCityIds,
        categoryIds: selectedCategoryIds,
        placementType,
        quantity,
        militaryEligible,
      },
      "add_item",
    );
  }

  async function saveDetails() {
    if (!session) return;
    if (!details.businessName.trim() || !details.contactName.trim() || !details.email.trim()) {
      setError("Please enter your business name, contact name, and email before saving details.");
      return;
    }
    await callAgent(
      {
        action: "save_details",
        sessionId: session.id,
        ...details,
        phone: details.smsConsent ? details.phone : "",
        militaryEligible,
      },
      "save_details",
    );
  }

  async function confirmCart() {
    if (!session) return;
    await callAgent({ action: "confirm", sessionId: session.id }, "confirm");
  }

  async function checkout() {
    if (!session) return;
    const data = await callAgent({ action: "checkout", sessionId: session.id }, "checkout");
    if (data?.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    }
  }

  async function removeItem(itemId: string) {
    if (!session) return;
    await callAgent({ action: "remove_item", sessionId: session.id, itemId }, "remove_item");
  }

  function toggleCity(cityId: string) {
    setSelectedCityIds((current) =>
      current.includes(cityId)
        ? current.filter((id) => id !== cityId)
        : [...current, cityId],
    );
  }

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  const canConfirm = cartItems.length > 0 && session?.status !== "checkout_created";
  const canCheckout = session?.status === "confirmed" || session?.status === "checkout_created";

  if (busyAction === "bootstrap" && !agentState) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          Preparing your shared visibility plan
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-6">
      <section className="min-w-0 space-y-5">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-white">
                  <Bot className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">
                    Shared Visibility Intake
                  </p>
                  <h1 className="text-xl font-black">Build a protected local visibility plan</h1>
                  <p className="mt-1 max-w-xl text-xs leading-5 text-blue-100/80">
                    {sharedPostcardEmotionCopy.valueLine}
                  </p>
                </div>
              </div>
              <StatusPill status={session?.status ?? "starting"} />
            </div>
          </div>

          <div className="max-h-[360px] space-y-3 overflow-y-auto p-5">
            {(agentState?.messages ?? []).map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-black text-slate-950">1. Where do you need to be remembered?</h2>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {options.cities.map((city) => {
              const active = selectedCityIds.includes(city.id);
              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => toggleCity(city.id)}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-left transition",
                    active
                      ? "border-blue-500 bg-blue-50 text-blue-950"
                      : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50",
                  )}
                >
                  <span className="block text-sm font-black">
                    {city.name}, {city.state}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">
                    {city.availableSpots} of 12 protected positions open
                    {city.foundingEligible ? " - Founding pricing" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-black text-slate-950">2. Protect your category</h2>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {options.categories.map((category) => {
              const active = selectedCategoryIds.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-left transition",
                    active
                      ? "border-blue-500 bg-blue-50 text-blue-950"
                      : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50",
                  )}
                >
                  <span className="block text-sm font-black">{category.name}</span>
                  <span className="mt-1 line-clamp-2 block text-xs text-slate-500">
                    {category.description ?? "Category-exclusive visibility for one serious local business."}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-black text-slate-950">3. Choose your visibility level</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {placements.map((placement) => {
              const active = placementType === placement.id;
              return (
                <button
                  key={placement.id}
                  type="button"
                  onClick={() => setPlacementType(placement.id)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition",
                    active
                      ? "border-blue-500 bg-blue-50 text-blue-950"
                      : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50",
                  )}
                >
                  <span className="block text-sm font-black">{placement.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{placement.body}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
            <label className="text-sm font-bold text-slate-700">
              Quantity
              <input
                type="number"
                min={1}
                max={12}
                value={quantity}
                disabled={placementType === "full_card_exclusivity"}
                onChange={(event) => setQuantity(Number(event.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={militaryEligible}
                onChange={(event) => setMilitaryEligible(event.target.checked)}
                className="h-4 w-4"
              />
              Apply military discount if eligible
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addToCart}
              disabled={busyAction === "add_item"}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {busyAction === "add_item" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add this visibility plan
            </button>
            <QuickButton onClick={() => setSelectedCityIds([])}>Add another city</QuickButton>
            <QuickButton onClick={() => setSelectedCategoryIds([])}>Add another category</QuickButton>
            <QuickButton onClick={() => setQuantity((value) => Math.min(12, value + 1))}>
              Add another spot
            </QuickButton>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-black text-slate-950">4. Make the offer feel clear</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <TextField label="Business name" value={details.businessName} onChange={(v) => setDetails({ ...details, businessName: v })} />
            <TextField label="Contact name" value={details.contactName} onChange={(v) => setDetails({ ...details, contactName: v })} />
            <TextField label="Phone (optional)" value={details.phone} onChange={(v) => setDetails({ ...details, phone: v })} />
            <TextField label="Email" value={details.email} onChange={(v) => setDetails({ ...details, email: v })} />
            <label className="md:col-span-2 flex gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold leading-5 text-slate-600">
              <input
                type="checkbox"
                checked={details.smsConsent}
                onChange={(event) => setDetails({ ...details, smsConsent: event.target.checked })}
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
              />
              <span>
                I agree HomeReach may text me about this request, including campaign information, quote follow-up, appointment coordination, proposal/order updates, and support replies. Message frequency varies. Msg and data rates may apply. Reply HELP for help or STOP to opt out. SMS consent is not required as a condition of purchase. Mobile opt-in data will not be shared with third parties or affiliates for marketing or promotional purposes. See <Link href="/terms" className="text-blue-700 underline">Terms</Link> and <Link href="/privacy" className="text-blue-700 underline">Privacy Policy</Link>.
              </span>
            </label>
            <TextField label="Website" value={details.websiteUrl} onChange={(v) => setDetails({ ...details, websiteUrl: v })} />
            <TextField label="Facebook page" value={details.facebookUrl} onChange={(v) => setDetails({ ...details, facebookUrl: v })} />
            <TextField label="Logo URL" value={details.logoUrl} onChange={(v) => setDetails({ ...details, logoUrl: v })} />
            <label className="text-sm font-bold text-slate-700">
              Logo upload optional
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setDetails({ ...details, logoFileName: file?.name ?? "" });
                }}
                className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
              />
              {details.logoFileName && (
                <span className="mt-1 block text-xs font-semibold text-slate-500">{details.logoFileName}</span>
              )}
            </label>
          </div>
          <div className="mt-3">
            <TextField
              label="Offer or headline"
              value={details.offerHeadline}
              onChange={(v) => setDetails({ ...details, offerHeadline: v })}
            />
          </div>
          <label className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={details.aiGenerateOffer}
              onChange={(event) => setDetails({ ...details, aiGenerateOffer: event.target.checked })}
              className="h-4 w-4"
            />
              Let AI shape this into a clearer local offer
          </label>
          <button
            type="button"
            onClick={saveDetails}
            disabled={busyAction === "save_details"}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {busyAction === "save_details" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save my visibility details
          </button>
        </div>
      </section>

      <aside className="lg:sticky lg:top-5 lg:self-start">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-black text-slate-950">Live cart</h2>
            </div>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              3-month minimum
            </p>
          </div>
          <div className="max-h-[460px] space-y-3 overflow-y-auto p-4">
            {cartItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                Pick cities, categories, and placement to build the order.
              </div>
            ) : (
              cartItems.map((item) => (
                <CartItem key={item.id} item={item} onRemove={() => removeItem(item.id)} />
              ))
            )}
          </div>
          <div className="border-t border-slate-200 p-5">
            <div className="space-y-2 text-sm">
              <SummaryRow label="Monthly subtotal" value={money(session?.subtotalCents ?? 0)} />
              <SummaryRow label="Discount" value={`-${money(session?.discountCents ?? 0)}`} />
              <SummaryRow label="Monthly total" value={money(session?.totalMonthlyCents ?? 0)} strong />
              <SummaryRow label="3-month minimum" value={money(session?.totalContractValueCents ?? 0)} />
            </div>
            <button
              type="button"
              onClick={confirmCart}
              disabled={!canConfirm || busyAction === "confirm"}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === "confirm" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Review order
            </button>
            <button
              type="button"
              onClick={checkout}
              disabled={!canCheckout || busyAction === "checkout"}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyAction === "checkout" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Continue to payment
            </button>
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
              Stripe is generated only after confirmation. Availability is rechecked immediately before checkout.
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-blue-900">
            <BadgeDollarSign className="h-5 w-5" />
            <h3 className="text-sm font-black">Founding Member pricing</h3>
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-blue-800">
            Eligible cities show founding pricing in the cart before payment. Existing checkout and exclusivity rules remain protected.
          </p>
        </div>
      </aside>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-100">
      <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.9)]" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ChatBubble({ message }: { message: AiMessageView }) {
  const assistant = message.role !== "user";
  return (
    <div className={cn("flex", assistant ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[86%] rounded-lg px-4 py-3 text-sm leading-6",
          assistant ? "bg-slate-100 text-slate-700" : "bg-blue-600 text-white",
        )}
      >
        {message.message}
      </div>
    </div>
  );
}

function QuickButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
    >
      {children}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-bold text-slate-700">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400"
      />
    </label>
  );
}

function CartItem({ item, onRemove }: { item: AiCartItemView; onRemove: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{item.cityName}</p>
          <p className="text-xs font-semibold text-slate-500">{item.categoryName}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          aria-label="Remove cart item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
        <span>{item.placementLabel}</span>
        <span className="text-right">Qty {item.quantity}</span>
        <span>{item.pricingTier.replace(/_/g, " ")}</span>
        <span className="text-right">{money(item.subtotalCents)}/mo</span>
      </div>
      {item.discountCode && (
        <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
          {item.discountCode.replace(/_/g, " ")} applied
        </p>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between", strong && "text-base font-black text-slate-950")}>
      <span className={strong ? "" : "text-slate-500"}>{label}</span>
      <span className="font-black text-slate-950">{value}</span>
    </div>
  );
}
