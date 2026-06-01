import { ImageResponse } from "next/og";
import {
  buildCustomStrategySelectionCandidate,
  buildStrategySelectionPlans,
  findStrategySelectionCandidate,
  getDefaultStrategySelectionCandidateId,
  type StrategySelectionCandidate,
  type StrategySelectionPlan,
} from "@/lib/political/campaign-strategy-selection";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const MONEY_WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const INTEGER = new Intl.NumberFormat("en-US");

const optionStyles = [
  {
    label: "A",
    eyebrow: "Option A",
    title: "Name Recognition Acceleration",
    message: "Make the candidate and office easy to understand.",
    background: "#C91F26",
    badgeColor: "#C91F26",
  },
  {
    label: "B",
    eyebrow: "Option B",
    title: "Route Density Plan",
    message: "Prioritize efficient mail routes and neighborhood repetition.",
    background: "#2859C7",
    badgeColor: "#1D4ED8",
  },
  {
    label: "C",
    eyebrow: "Option C",
    title: "Trust + Proof Sequence",
    message: "Use approved public record and validator proof.",
    background: "linear-gradient(135deg, #4938B6 0%, #B21F31 100%)",
    badgeColor: "#1E40AF",
  },
  {
    label: "D",
    eyebrow: "Option D",
    title: "Final Window Reminder",
    message: "Mail around absentee, early vote, and Election Day.",
    background: "#091431",
    badgeColor: "#0F172A",
  },
] as const;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const candidateParam =
    url.searchParams.get("candidate") ?? getDefaultStrategySelectionCandidateId();
  const candidate = withQueryOverrides(
    findStrategySelectionCandidate(candidateParam) ??
      buildCustomStrategySelectionCandidate(candidateParam),
    url,
  );
  const plans = buildStrategySelectionPlans(candidate).slice(0, 4);
  const portraitUrl = absolutePortraitUrl(candidate, url);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1600px",
          height: "540px",
          display: "flex",
          gap: "20px",
          background: "#020817",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
          padding: "8px 5px 0",
        }}
      >
        {plans.map((plan, index) => (
          <CandidateOptionCard
            key={plan.id}
            candidate={candidate}
            candidateLine={candidateLine(candidate)}
            plan={plan}
            portraitUrl={portraitUrl}
            styleConfig={optionStyles[index] ?? optionStyles[0]}
          />
        ))}
      </div>
    ),
    {
      width: 1600,
      height: 540,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function withQueryOverrides(candidate: StrategySelectionCandidate, url: URL): StrategySelectionCandidate {
  const office = clean(url.searchParams.get("office"));
  const city = clean(url.searchParams.get("city"));
  const county = clean(url.searchParams.get("county"));
  const state = clean(url.searchParams.get("state"));
  const geography = [city, county, state].filter(Boolean).join(", ");
  return {
    ...candidate,
    office: office || candidate.office,
    county: county || candidate.county,
    geography: geography || candidate.geography,
  };
}

function CandidateOptionCard({
  candidate,
  candidateLine,
  plan,
  portraitUrl,
  styleConfig,
}: {
  candidate: StrategySelectionCandidate;
  candidateLine: string;
  plan: StrategySelectionPlan;
  portraitUrl: string | null;
  styleConfig: (typeof optionStyles)[number];
}) {
  return (
    <div
      style={{
        flex: 1,
        height: "532px",
        display: "flex",
        flexDirection: "column",
        borderRadius: "20px 20px 0 0",
        overflow: "hidden",
        border: "1px solid rgba(226,232,240,0.92)",
        background: "#F8FAFC",
      }}
    >
      <div
        style={{
          height: "330px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: styleConfig.background,
          padding: "28px 26px 30px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: "240px" }}>
            <div style={{ fontSize: 16, lineHeight: 1, fontWeight: 900, color: "#DBEAFE" }}>
              {styleConfig.eyebrow}
            </div>
            <div
              style={{
                marginTop: "20px",
                fontSize: 29,
                lineHeight: 1.08,
                fontWeight: 900,
                color: "#ffffff",
              }}
            >
              {styleConfig.title}
            </div>
          </div>

          <div
            style={{
              width: "75px",
              height: "100px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "20px",
              background: "#ffffff",
              color: styleConfig.badgeColor,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: "#94A3B8" }}>Plan</div>
            <div style={{ marginTop: "7px", fontSize: 48, lineHeight: 1, fontWeight: 900 }}>
              {styleConfig.label}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <CandidateAvatar candidate={candidate} portraitUrl={portraitUrl} />
          <div
            style={{
              width: "265px",
              fontSize: 16,
              lineHeight: 1.15,
              fontWeight: 900,
              color: "#E2E8F0",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {shortText(candidateLine, 29)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 21,
            lineHeight: 1.38,
            fontWeight: 500,
            color: "#ffffff",
          }}
        >
          {styleConfig.message}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: "20px",
          background: "#F8FAFC",
        }}
      >
        <div style={{ display: "flex", gap: "10px" }}>
          <MetricBox label="Cost" value={MONEY_WHOLE.format(plan.totalCampaignCostCents / 100)} />
          <MetricBox label="Drops" value={String(plan.drops)} />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <MetricBox label="Households" value={INTEGER.format(plan.estimatedHouseholds)} />
          <MetricBox label="Timeline" value={plan.timelineLength} />
        </div>
      </div>
    </div>
  );
}

function CandidateAvatar({
  candidate,
  portraitUrl,
}: {
  candidate: StrategySelectionCandidate;
  portraitUrl: string | null;
}) {
  if (portraitUrl) {
    return (
      <img
        src={portraitUrl}
        width="46"
        height="46"
        style={{
          width: "46px",
          height: "46px",
          borderRadius: "10px",
          objectFit: "cover",
          border: "1px solid rgba(255,255,255,0.18)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "46px",
        height: "46px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "10px",
        background: "#0F172A",
        color: "#FFFFFF",
        fontSize: 15,
        fontWeight: 900,
        border: "1px solid rgba(255,255,255,0.18)",
      }}
    >
      {initials(candidate.candidateName)}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        height: "70px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        borderRadius: "10px",
        border: "1px solid #D9E2EF",
        background: "#FFFFFF",
        padding: "0 12px",
      }}
    >
      <div style={{ fontSize: 13, lineHeight: 1, fontWeight: 900, color: "#94A3B8" }}>{label}</div>
      <div style={{ marginTop: "10px", fontSize: 20, lineHeight: 1, fontWeight: 900, color: "#020817" }}>
        {shortText(value, 16)}
      </div>
    </div>
  );
}

function absolutePortraitUrl(candidate: StrategySelectionCandidate, url: URL) {
  const portraitUrl = candidate.portrait?.url;
  if (!portraitUrl) return null;
  try {
    return new URL(portraitUrl, url.origin).toString();
  } catch {
    return null;
  }
}

function candidateLine(candidate: StrategySelectionCandidate) {
  return [candidate.candidateName, candidate.office].filter(Boolean).join(" / ");
}

function clean(value: string | null) {
  return value?.replace(/\s+/g, " ").trim().slice(0, 90) ?? "";
}

function initials(value: string) {
  const letters = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return letters || "HR";
}

function shortText(value: string, length = 86) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, Math.max(0, length - 3))}...` : text;
}
