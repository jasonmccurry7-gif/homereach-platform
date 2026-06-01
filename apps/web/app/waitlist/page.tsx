import type { Metadata } from "next";
import { WaitlistForm } from "./waitlist-form";
import { db, cities } from "@homereach/db";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export const dynamic = "force-dynamic";

const productCopy: Record<
  string,
  { title: string; body: string; button: string }
> = {
  "procurement-savings-review": {
    title: "Get a free supply cost review",
    body: "Share your business details and HomeReach will review your recurring supplies, current vendors, monthly spend range, and biggest purchasing pain point before recommending a next step.",
    button: "Request my free review",
  },
  "ai-website-assistant": {
    title: "Request the AI Web Assistant",
    body: "Get a review-ready setup for a supervised AI front desk that answers website visitors, captures leads, and routes urgent requests.",
    button: "Request assistant demo",
  },
  "local-seo": {
    title: "Request your local SEO landing page plan",
    body: "Tell us your service, geography, website, and proof points. HomeReach will route the request into an approval-gated local SEO plan before anything publishes.",
    button: "Request landing page plan",
  },
  "local-growth-review": {
    title: "Request your local growth review",
    body: "Share your market, goals, and current growth work. HomeReach will prepare a review-ready path for the next local opportunity to pursue.",
    button: "Request growth review",
  },
  reputation: {
    title: "Request reputation support",
    body: "Get a review-ready path for better customer follow-up, review requests, and local trust visibility.",
    button: "Request reputation review",
  },
  "social-content": {
    title: "Request approval-ready social content",
    body: "Tell us your offer, channels, audience, and approval owner. HomeReach will route the request into draft-only content support before anything is posted.",
    button: "Request content plan",
  },
  "government-contracts": {
    title: "Request government contract support",
    body: "Share your organization details and HomeReach will route the request into an approval-gated contract support review.",
    button: "Request contract review",
  },
  "contractos-readiness-scan": {
    title: "Start your ContractOS readiness scan",
    body: "Tell us about your business and HomeReach will help you understand government contract readiness, missing requirements, and the safest next step.",
    button: "Start readiness scan",
  },
  "contractos-managed-bid-help": {
    title: "Request ContractOS bid support",
    body: "Share the opportunity you are considering and HomeReach will review fit, risk, pricing guardrails, documents, and whether a subcontractor path is safer.",
    button: "Request bid review",
  },
  "contractos-document-review": {
    title: "Request a ContractOS document review",
    body: "Use this lane for RFQs, RFPs, SOWs, amendments, and bid instructions that need plain-English review before action.",
    button: "Request document review",
  },
  "contractos-watchlist": {
    title: "Add an opportunity to your ContractOS watchlist",
    body: "HomeReach will help track deadlines, fit, missing documents, and whether the opportunity is worth pursuing.",
    button: "Add to watchlist",
  },
};

const publicProductIntents = new Set(Object.keys(productCopy));

export const metadata: Metadata = {
  title: "Request Access - HomeReach",
  description:
    "Request a HomeReach review for supply savings, local business growth tools, or early product access.",
  alternates: { canonical: "/waitlist" },
};

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; product?: string }>;
}) {
  const { city: preselectedCitySlug, product } = await searchParams;
  const productIntent =
    product && publicProductIntents.has(product) ? product : null;
  const copy = productIntent ? productCopy[productIntent] : null;

  const allCities = await db
    .select({
      id: cities.id,
      name: cities.name,
      slug: cities.slug,
      isActive: cities.isActive,
    })
    .from(cities);

  const comingSoonCities = allCities.filter((c) => !c.isActive);
  const preselected =
    allCities.find((c) => c.slug === preselectedCitySlug) ?? null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50">
      <SiteHeader />
      <main className="flex w-full max-w-full flex-col items-center overflow-x-hidden px-4 py-12 sm:py-16">
        <div className="w-full min-w-0 max-w-[min(100%,28rem)]">
          <div className="mb-8 text-center">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-600">
              HomeReach
            </div>
            <h1 className="break-words text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
              {copy?.title ?? "Join the waitlist"}
            </h1>
            <p className="mt-2 break-words text-gray-500">
              {copy?.body ??
                "We're expanding fast. Get notified the moment spots open in your city."}
            </p>
            {productIntent === "procurement-savings-review" ? (
              <p className="mt-3 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
                Takes about 60 seconds. No invoices or vendor changes required.
              </p>
            ) : productIntent === "local-growth-review" ? (
              <p className="mt-3 rounded-full border border-cyan-100 bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-800">
                Advisory only. No campaigns, outreach, pricing, or public claims
                move forward without approval.
              </p>
            ) : productIntent === "local-seo" ? (
              <p className="mt-3 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-800">
                No page, metadata, schema, redirect, or local claim goes live
                without human approval.
              </p>
            ) : productIntent === "reputation" ? (
              <p className="mt-3 rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-800">
                No review requests, replies, or testimonials are sent or
                published without approval.
              </p>
            ) : productIntent === "social-content" ? (
              <p className="mt-3 rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-800">
                No social post, DM, ad, political message, or public claim is
                sent or published without human approval.
              </p>
            ) : productIntent?.startsWith("contractos") ||
              productIntent === "government-contracts" ? (
              <p className="mt-3 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-800">
                No bid, pricing, certification, subcontractor commitment, or
                official submission happens without human approval.
              </p>
            ) : null}
          </div>
          <div className="w-full max-w-full rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
            <WaitlistForm
              cities={comingSoonCities}
              preselectedCityId={preselected?.id ?? null}
              productIntent={productIntent}
              submitLabel={copy?.button ?? "Join the waitlist"}
            />
          </div>
          <p className="mt-4 text-center text-xs text-gray-400">
            {productIntent === "procurement-savings-review"
              ? "No vendor changes, savings claims, or supplier actions happen without human approval."
              : productIntent === "local-growth-review"
                ? "No guaranteed revenue claims, market dominance claims, or campaign actions. Every recommendation is reviewed before use."
                : productIntent === "local-seo"
                  ? "No ranking guarantees, fake local offices, doorway pages, or unsupported local claims. Publishing remains approval-gated."
                  : productIntent === "reputation"
                    ? "No fake reviews, review gating, or public testimonial use. Every customer-facing action requires approval."
                    : productIntent === "social-content"
                      ? "Drafting service only. No auto-posting, bulk messaging, political publishing, or unsupported claims. Everything customer-facing requires approval."
                      : productIntent?.startsWith("contractos") ||
                          productIntent === "government-contracts"
                        ? "ContractOS prepares review-ready guidance only. No awards, compliance, eligibility, profitability, or submission outcomes are guaranteed."
                    : "No spam. We'll only contact you when the right HomeReach path is ready."}
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
