"use client";

import { useState } from "react";
import Link from "next/link";

const PROCUREMENT_BUSINESS_TYPES = [
  "Restaurant / QSR",
  "Bakery / coffee shop",
  "Pizza shop",
  "Contractor / construction",
  "HVAC / plumbing / electrical",
  "Landscaping / lawn care",
  "Auto shop",
  "Retail store",
  "Small manufacturer",
  "Other local business",
];

const MONTHLY_SUPPLY_SPEND = [
  "Under $2,500",
  "$2,500 - $10,000",
  "$10,000 - $25,000",
  "$25,000+",
  "Not sure yet",
];

const PROCUREMENT_PAIN_POINTS = [
  "Prices keep going up",
  "Compare supplier prices",
  "No centralized purchasing visibility",
  "Reduce waste or overbuying",
  "Avoid stockouts",
  "Build a reorder list",
  "Find savings opportunities",
  "Not sure yet",
];

const REPUTATION_GOALS = [
  "More Google reviews",
  "Referral requests",
  "Testimonial capture",
  "Follow-up after completed jobs",
  "Review response help",
  "Not sure yet",
];

const RECENT_CUSTOMER_COUNTS = [
  "Under 10 recent customers",
  "10 - 25 recent customers",
  "25 - 50 recent customers",
  "50+ recent customers",
  "Not sure yet",
];

const LOCAL_GROWTH_INDUSTRIES = [
  "Roofing / exterior services",
  "HVAC / plumbing / electrical",
  "Landscaping / lawn care",
  "Concrete / construction",
  "Restaurant / food service",
  "Real estate",
  "Med spa / wellness",
  "Dental / healthcare",
  "Political campaign",
  "Other local business",
];

const LOCAL_GROWTH_GOALS = [
  "More local leads",
  "Enter a new neighborhood",
  "Win more jobs near current customers",
  "Pair direct mail and digital",
  "Improve reputation and referrals",
  "Promote a seasonal offer",
  "Review competitor areas",
  "Not sure yet",
];

const LOCAL_GROWTH_MARKETING = [
  "Mostly referrals",
  "Google Business Profile",
  "Local SEO / website",
  "Postcards / direct mail",
  "Paid ads",
  "Social media",
  "No consistent system",
  "Not sure yet",
];

const MONTHLY_GROWTH_BUDGET = [
  "Under $500",
  "$500 - $1,000",
  "$1,000 - $2,500",
  "$2,500+",
  "Not sure yet",
];

const LOCAL_SEO_PAGE_GOALS = [
  "More local search visibility",
  "New city or service page",
  "Campaign landing page",
  "Postcard QR destination",
  "Google Business Profile support",
  "Conversion page review",
  "Not sure yet",
];

const LOCAL_SEO_PAGE_TYPES = [
  "City/service landing page",
  "Campaign landing page",
  "QR landing page",
  "Local authority page",
  "Existing page improvement",
  "Not sure yet",
];

const SOCIAL_CONTENT_PACKAGES = [
  "8 draft posts / month",
  "16 draft posts / month",
  "Launch or announcement batch",
  "Seasonal campaign batch",
  "Direct mail support content",
  "Not sure yet",
];

const SOCIAL_CONTENT_GOALS = [
  "Stay visible locally",
  "Promote an offer",
  "Build trust and credibility",
  "Support a direct mail campaign",
  "Promote an event",
  "Political awareness",
  "Recruiting or hiring",
  "Not sure yet",
];

const SOCIAL_CONTENT_ASSET_STATUS = [
  "Logo and photos ready",
  "Logo only",
  "Some photos available",
  "Need creative guidance",
  "Not sure yet",
];

const CONTRACTOS_PRODUCT_INTENTS = new Set([
  "government-contracts",
  "contractos-readiness-scan",
  "contractos-managed-bid-help",
  "contractos-document-review",
  "contractos-watchlist",
]);

const CONTRACTOS_REQUEST_TYPES = [
  "Readiness scan",
  "Opportunity watchlist",
  "Document review",
  "Bid/no-bid review",
  "Proposal assist",
  "Managed bid support",
  "Not sure yet",
];

const CONTRACTOS_GOV_STATUSES = [
  "Registered in SAM.gov",
  "Have UEI but not fully registered",
  "Not registered yet",
  "Already bidding",
  "Subcontractor path",
  "Not sure yet",
];

const CONTRACTOS_SUPPORT_NEEDS = [
  "Find relevant opportunities",
  "Understand one solicitation",
  "Decide bid/no-bid",
  "Build a document checklist",
  "Prepare proposal package",
  "Review pricing and risk",
  "Track deadlines",
  "Not sure yet",
];

interface WaitlistFormProps {
  cities: { id: string; name: string; slug: string }[];
  preselectedCityId: string | null;
  productIntent?: string | null;
  submitLabel?: string;
}

export function WaitlistForm({
  cities,
  preselectedCityId,
  productIntent,
  submitLabel = "Join the waitlist",
}: WaitlistFormProps) {
  const isProcurementReview = productIntent === "procurement-savings-review";
  const isReputationReview = productIntent === "reputation";
  const isLocalGrowthReview = productIntent === "local-growth-review";
  const isLocalSeoPlan = productIntent === "local-seo";
  const isSocialContentPlan = productIntent === "social-content";
  const isContractOSRequest = Boolean(
    productIntent && CONTRACTOS_PRODUCT_INTENTS.has(productIntent),
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [cityId, setCityId] = useState(preselectedCityId ?? "");
  const [businessType, setBusinessType] = useState("");
  const [monthlySupplySpend, setMonthlySupplySpend] = useState("");
  const [biggestProcurementPain, setBiggestProcurementPain] = useState("");
  const [primarySuppliers, setPrimarySuppliers] = useState("");
  const [website, setWebsite] = useState("");
  const [reputationGoal, setReputationGoal] = useState("");
  const [recentCustomerCount, setRecentCustomerCount] = useState("");
  const [reviewProfileUrl, setReviewProfileUrl] = useState("");
  const [growthIndustry, setGrowthIndustry] = useState("");
  const [primaryMarket, setPrimaryMarket] = useState("");
  const [growthGoal, setGrowthGoal] = useState("");
  const [currentMarketing, setCurrentMarketing] = useState("");
  const [monthlyGrowthBudget, setMonthlyGrowthBudget] = useState("");
  const [growthNotes, setGrowthNotes] = useState("");
  const [seoPrimaryService, setSeoPrimaryService] = useState("");
  const [seoTargetGeography, setSeoTargetGeography] = useState("");
  const [seoPageGoal, setSeoPageGoal] = useState("");
  const [seoPageType, setSeoPageType] = useState("");
  const [seoExistingPageUrl, setSeoExistingPageUrl] = useState("");
  const [seoProofPoints, setSeoProofPoints] = useState("");
  const [contentPackage, setContentPackage] = useState("");
  const [contentGoal, setContentGoal] = useState("");
  const [contentChannels, setContentChannels] = useState("");
  const [contentAudience, setContentAudience] = useState("");
  const [contentPrimaryOffer, setContentPrimaryOffer] = useState("");
  const [contentBrandVoice, setContentBrandVoice] = useState("");
  const [contentAssetsStatus, setContentAssetsStatus] = useState("");
  const [contentApprovalOwner, setContentApprovalOwner] = useState("");
  const [contentNotes, setContentNotes] = useState("");
  const [contractosRequestType, setContractosRequestType] = useState(
    productIntent === "contractos-readiness-scan"
      ? "Readiness scan"
      : productIntent === "contractos-managed-bid-help"
        ? "Managed bid support"
        : productIntent === "contractos-document-review"
          ? "Document review"
          : productIntent === "contractos-watchlist"
            ? "Opportunity watchlist"
            : "",
  );
  const [contractosIndustry, setContractosIndustry] = useState("");
  const [contractosGovStatus, setContractosGovStatus] = useState("");
  const [contractosOpportunityUrl, setContractosOpportunityUrl] = useState("");
  const [contractosDeadline, setContractosDeadline] = useState("");
  const [contractosSupportNeed, setContractosSupportNeed] = useState("");
  const [contractosNotes, setContractosNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const productContext = isProcurementReview
        ? {
            businessType,
            monthlySupplySpend,
            biggestProcurementPain,
            primarySuppliers,
            smsConsent: smsConsent ? "true" : "false",
            smsConsentSource: "waitlist_form_optional_sms_checkbox",
            optInSource: smsConsent ? "waitlist_form_sms_checkbox" : undefined,
          }
        : isReputationReview
          ? {
              website,
              reputationGoal,
              recentCustomerCount,
              reviewProfileUrl,
              smsConsent: smsConsent ? "true" : "false",
              smsConsentSource: "waitlist_form_optional_sms_checkbox",
              optInSource: smsConsent
                ? "waitlist_form_sms_checkbox"
                : undefined,
            }
          : isLocalGrowthReview
            ? {
                website,
                growthIndustry,
                primaryMarket,
                growthGoal,
                currentMarketing,
                monthlyGrowthBudget,
                growthNotes,
                smsConsent: smsConsent ? "true" : "false",
                smsConsentSource: "waitlist_form_optional_sms_checkbox",
                optInSource: smsConsent
                  ? "waitlist_form_sms_checkbox"
                  : undefined,
              }
            : isLocalSeoPlan
              ? {
                  website,
                  seoPrimaryService,
                  seoTargetGeography,
                  seoPageGoal,
                  seoPageType,
                  seoExistingPageUrl,
                  seoProofPoints,
                  smsConsent: smsConsent ? "true" : "false",
                  smsConsentSource: "waitlist_form_optional_sms_checkbox",
                  optInSource: smsConsent
                    ? "waitlist_form_sms_checkbox"
                    : undefined,
                }
              : isSocialContentPlan
                ? {
                    website,
                    contentPackage,
                    contentGoal,
                    contentChannels,
                    contentAudience,
                    contentPrimaryOffer,
                    contentBrandVoice,
                    contentAssetsStatus,
                    contentApprovalOwner,
                    contentNotes,
                    smsConsent: smsConsent ? "true" : "false",
                    smsConsentSource: "waitlist_form_optional_sms_checkbox",
                    optInSource: smsConsent
                      ? "waitlist_form_sms_checkbox"
                      : undefined,
                  }
                : isContractOSRequest
                  ? {
                      website,
                      contractosRequestType,
                      contractosIndustry,
                      contractosGovStatus,
                      contractosOpportunityUrl,
                      contractosDeadline,
                      contractosSupportNeed,
                      contractosNotes,
                      smsConsent: smsConsent ? "true" : "false",
                      smsConsentSource: "waitlist_form_optional_sms_checkbox",
                      optInSource: smsConsent
                        ? "waitlist_form_sms_checkbox"
                        : undefined,
                    }
              : undefined;

      const payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        businessName: businessName.trim(),
        cityId: cityId || undefined,
        productIntent,
        productContext,
      };

      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="py-4 text-center">
        <h2 className="text-xl font-bold text-gray-900">
          {isProcurementReview
            ? "Savings review requested"
            : isLocalGrowthReview
              ? "Local growth review requested"
              : isLocalSeoPlan
                ? "Local SEO request received"
                : isSocialContentPlan
                  ? "Social content request received"
                  : isContractOSRequest
                    ? "ContractOS request received"
                : isReputationReview
                  ? "Reputation request received"
                  : "You're on the list!"}
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          {isProcurementReview ? (
            <>
              We&apos;ll email <strong>{email}</strong> with the next step for
              your purchasing review.
            </>
          ) : isLocalGrowthReview ? (
            <>
              We&apos;ll email <strong>{email}</strong> with the next step for
              your local growth review.
            </>
          ) : isLocalSeoPlan ? (
            <>
              We&apos;ll email <strong>{email}</strong> with the next step for
              your local SEO and landing page plan.
            </>
          ) : isSocialContentPlan ? (
            <>
              We&apos;ll email <strong>{email}</strong> with the next step for
              your approval-ready social content plan.
            </>
          ) : isContractOSRequest ? (
            <>
              We&apos;ll email <strong>{email}</strong> with the next step for
              your ContractOS review.
            </>
          ) : isReputationReview ? (
            <>
              We&apos;ll email <strong>{email}</strong> with the next step for
              your reputation follow-up review.
            </>
          ) : (
            <>
              We&apos;ll email you at <strong>{email}</strong> the moment spots
              open in your city.
            </>
          )}
        </p>
        {productIntent ? (
          <p className="mt-2 text-sm text-gray-500">
            Your request is tagged for the selected HomeReach product path.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Your name
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Business name or working name
        </label>
        <input
          type="text"
          required
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Acme Bakery Co."
          className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Email address
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@acmebakery.com"
          className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Phone{" "}
          {isProcurementReview ? null : (
            <span className="text-xs font-normal text-gray-400">
              (optional)
            </span>
          )}
        </label>
        <input
          type="tel"
          required={isProcurementReview}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(512) 555-0100"
          className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <label className="mt-2 flex gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
          />
          <span>
            I agree HomeReach may text me about this request, including
            requested information, quote follow-up, appointment coordination,
            service updates, and support replies. Message frequency varies. Msg
            and data rates may apply. Reply HELP for help or STOP to opt out.
            SMS consent is not required as a condition of purchase. Mobile
            opt-in data will not be shared with third parties or affiliates for
            marketing or promotional purposes. See{" "}
            <Link
              href="/terms"
              className="font-semibold text-blue-700 underline"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="font-semibold text-blue-700 underline"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>
      </div>

      {isProcurementReview ? (
        <fieldset className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
          <legend className="px-1 text-sm font-semibold text-blue-900">
            Savings review details
          </legend>
          <p className="text-xs font-medium leading-5 text-blue-900/80">
            This helps us route your request. Estimates are fine, and no vendor
            action happens from this form.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Business type
            </label>
            <select
              required
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select business type</option>
              {PROCUREMENT_BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Estimated monthly supply spend
            </label>
            <select
              required
              value={monthlySupplySpend}
              onChange={(e) => setMonthlySupplySpend(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select range</option>
              {MONTHLY_SUPPLY_SPEND.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Main thing you want fixed
            </label>
            <select
              required
              value={biggestProcurementPain}
              onChange={(e) => setBiggestProcurementPain(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select priority</option>
              {PROCUREMENT_PAIN_POINTS.map((painPoint) => (
                <option key={painPoint} value={painPoint}>
                  {painPoint}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Main suppliers{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={primarySuppliers}
              onChange={(e) => setPrimarySuppliers(e.target.value)}
              placeholder="GFS, BakeMark, Restaurant Depot, Grainger"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </fieldset>
      ) : null}

      {isReputationReview ? (
        <fieldset className="space-y-4 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
          <legend className="px-1 text-sm font-semibold text-violet-900">
            Reputation follow-up details
          </legend>
          <p className="text-xs font-medium leading-5 text-violet-900/80">
            This helps us route your request. No review requests, replies, or
            testimonial use happens from this form.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Website{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Main reputation goal
            </label>
            <select
              required
              value={reputationGoal}
              onChange={(e) => setReputationGoal(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select goal</option>
              {REPUTATION_GOALS.map((goal) => (
                <option key={goal} value={goal}>
                  {goal}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Recent happy customers or completed jobs
            </label>
            <select
              required
              value={recentCustomerCount}
              onChange={(e) => setRecentCustomerCount(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select range</option>
              {RECENT_CUSTOMER_COUNTS.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Review profile link{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="url"
              value={reviewProfileUrl}
              onChange={(e) => setReviewProfileUrl(e.target.value)}
              placeholder="Google Business Profile, Facebook, Yelp, or other review page"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </fieldset>
      ) : null}

      {isLocalGrowthReview ? (
        <fieldset className="space-y-4 rounded-xl border border-cyan-100 bg-cyan-50/40 p-4">
          <legend className="px-1 text-sm font-semibold text-cyan-900">
            Local growth review details
          </legend>
          <p className="text-xs font-medium leading-5 text-cyan-900/80">
            This helps us prepare a practical opportunity review. No campaign,
            outreach, or claim is made from this form.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Website{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Industry
            </label>
            <select
              required
              value={growthIndustry}
              onChange={(e) => setGrowthIndustry(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select industry</option>
              {LOCAL_GROWTH_INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Primary city or service area
            </label>
            <input
              type="text"
              required
              value={primaryMarket}
              onChange={(e) => setPrimaryMarket(e.target.value)}
              placeholder="Example: Columbus, OH or north Austin neighborhoods"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Main growth goal
            </label>
            <select
              required
              value={growthGoal}
              onChange={(e) => setGrowthGoal(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select goal</option>
              {LOCAL_GROWTH_GOALS.map((goal) => (
                <option key={goal} value={goal}>
                  {goal}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Current main marketing channel
            </label>
            <select
              required
              value={currentMarketing}
              onChange={(e) => setCurrentMarketing(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select current channel</option>
              {LOCAL_GROWTH_MARKETING.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Monthly growth budget{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <select
              value={monthlyGrowthBudget}
              onChange={(e) => setMonthlyGrowthBudget(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select range</option>
              {MONTHLY_GROWTH_BUDGET.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              What should we know?{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <textarea
              value={growthNotes}
              onChange={(e) => setGrowthNotes(e.target.value)}
              placeholder="Example: strongest neighborhoods, upcoming season, competitors, recent jobs, or areas you want to grow into."
              rows={4}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </fieldset>
      ) : null}

      {isLocalSeoPlan ? (
        <fieldset className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
          <legend className="px-1 text-sm font-semibold text-indigo-900">
            Local SEO landing page details
          </legend>
          <p className="text-xs font-medium leading-5 text-indigo-900/80">
            This helps us prepare a review-ready local page plan. No SEO page,
            metadata, schema, redirect, citation, or local claim is published
            from this form.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Website{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Primary service
            </label>
            <input
              type="text"
              required
              value={seoPrimaryService}
              onChange={(e) => setSeoPrimaryService(e.target.value)}
              placeholder="Example: roofing, med spa, emergency HVAC, political mail"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Target city, county, ZIP, or service area
            </label>
            <input
              type="text"
              required
              value={seoTargetGeography}
              onChange={(e) => setSeoTargetGeography(e.target.value)}
              placeholder="Example: Columbus, OH or Franklin County roofing"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Page goal
            </label>
            <select
              required
              value={seoPageGoal}
              onChange={(e) => setSeoPageGoal(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select goal</option>
              {LOCAL_SEO_PAGE_GOALS.map((goal) => (
                <option key={goal} value={goal}>
                  {goal}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Page type
            </label>
            <select
              required
              value={seoPageType}
              onChange={(e) => setSeoPageType(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select page type</option>
              {LOCAL_SEO_PAGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Existing page URL{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="url"
              value={seoExistingPageUrl}
              onChange={(e) => setSeoExistingPageUrl(e.target.value)}
              placeholder="https://example.com/service-area"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Proof points or notes{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <textarea
              value={seoProofPoints}
              onChange={(e) => setSeoProofPoints(e.target.value)}
              placeholder="Example: years in business, neighborhoods served, campaigns, approved offers, photos, testimonials available, or claims that need proof."
              rows={4}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </fieldset>
      ) : null}

      {isSocialContentPlan ? (
        <fieldset className="space-y-4 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
          <legend className="px-1 text-sm font-semibold text-sky-900">
            Social content drafting details
          </legend>
          <p className="text-xs font-medium leading-5 text-sky-900/80">
            This helps us prepare a content plan. No posts, DMs, ads, political
            messages, or public claims are sent, scheduled, or published from
            this form.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Website{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Content package
            </label>
            <select
              required
              value={contentPackage}
              onChange={(e) => setContentPackage(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select package</option>
              {SOCIAL_CONTENT_PACKAGES.map((contentPackageOption) => (
                <option
                  key={contentPackageOption}
                  value={contentPackageOption}
                >
                  {contentPackageOption}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Main content goal
            </label>
            <select
              required
              value={contentGoal}
              onChange={(e) => setContentGoal(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select goal</option>
              {SOCIAL_CONTENT_GOALS.map((goal) => (
                <option key={goal} value={goal}>
                  {goal}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Primary channels
            </label>
            <input
              type="text"
              required
              value={contentChannels}
              onChange={(e) => setContentChannels(e.target.value)}
              placeholder="Example: Facebook, Instagram, LinkedIn, Google Business Profile"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Target audience
            </label>
            <input
              type="text"
              required
              value={contentAudience}
              onChange={(e) => setContentAudience(e.target.value)}
              placeholder="Example: homeowners near current jobs, past customers, local parents"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Offer, topic, or promotion
            </label>
            <input
              type="text"
              required
              value={contentPrimaryOffer}
              onChange={(e) => setContentPrimaryOffer(e.target.value)}
              placeholder="Example: spring cleanup, roof inspections, new menu item, campaign launch"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Brand voice{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={contentBrandVoice}
              onChange={(e) => setContentBrandVoice(e.target.value)}
              placeholder="Example: friendly, premium, direct, community-focused"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Assets available
            </label>
            <select
              required
              value={contentAssetsStatus}
              onChange={(e) => setContentAssetsStatus(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select asset status</option>
              {SOCIAL_CONTENT_ASSET_STATUS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Approval owner
            </label>
            <input
              type="text"
              required
              value={contentApprovalOwner}
              onChange={(e) => setContentApprovalOwner(e.target.value)}
              placeholder="Who approves posts before they are used?"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Notes{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <textarea
              value={contentNotes}
              onChange={(e) => setContentNotes(e.target.value)}
              placeholder="Examples, links, topics to avoid, upcoming deadlines, compliance notes, or posts you liked."
              rows={4}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </fieldset>
      ) : null}

      {isContractOSRequest ? (
        <fieldset className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
          <legend className="px-1 text-sm font-semibold text-blue-900">
            ContractOS details
          </legend>
          <p className="text-xs font-medium leading-5 text-blue-900/80">
            This helps us prepare a readiness or opportunity review. No bid,
            pricing commitment, certification, or submission happens from this
            form.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Website{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Request type
            </label>
            <select
              required
              value={contractosRequestType}
              onChange={(e) => setContractosRequestType(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select request type</option>
              {CONTRACTOS_REQUEST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Business type
            </label>
            <input
              type="text"
              required
              value={contractosIndustry}
              onChange={(e) => setContractosIndustry(e.target.value)}
              placeholder="Example: landscaping, construction, printing, logistics"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Government contracting status
            </label>
            <select
              required
              value={contractosGovStatus}
              onChange={(e) => setContractosGovStatus(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select current status</option>
              {CONTRACTOS_GOV_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Main support need
            </label>
            <select
              required
              value={contractosSupportNeed}
              onChange={(e) => setContractosSupportNeed(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select support need</option>
              {CONTRACTOS_SUPPORT_NEEDS.map((need) => (
                <option key={need} value={need}>
                  {need}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Opportunity or solicitation link{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="url"
              value={contractosOpportunityUrl}
              onChange={(e) => setContractosOpportunityUrl(e.target.value)}
              placeholder="SAM.gov or agency link"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Known deadline{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={contractosDeadline}
              onChange={(e) => setContractosDeadline(e.target.value)}
              placeholder="Example: June 14, 2026 or not sure yet"
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Notes{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>
            <textarea
              value={contractosNotes}
              onChange={(e) => setContractosNotes(e.target.value)}
              placeholder="Example: services you provide, contract you are watching, missing documents, certifications, subcontractor needs, or questions."
              rows={4}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </fieldset>
      ) : null}

      {cities.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Your city
          </label>
          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select a city</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className={`min-h-11 w-full rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-60 ${
          isProcurementReview
            ? "bg-emerald-600 hover:bg-emerald-700"
            : isLocalGrowthReview
              ? "bg-cyan-600 hover:bg-cyan-700"
              : isLocalSeoPlan
                ? "bg-indigo-600 hover:bg-indigo-700"
              : isSocialContentPlan
                ? "bg-sky-600 hover:bg-sky-700"
                : isContractOSRequest
                  ? "bg-blue-700 hover:bg-blue-800"
                : isReputationReview
                  ? "bg-violet-600 hover:bg-violet-700"
                  : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {loading ? "Submitting..." : submitLabel}
      </button>
    </form>
  );
}
