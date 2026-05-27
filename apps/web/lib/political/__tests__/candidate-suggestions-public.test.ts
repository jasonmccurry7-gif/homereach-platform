import { describe, expect, it } from "vitest";
import {
  normalizePublicCandidateSearchParams,
  toPublicCandidateSuggestion,
} from "../candidate-suggestions-public";
import type { CandidateSuggestion } from "../candidate-intelligence/types";

describe("public candidate suggestions", () => {
  it("clamps public search inputs before service-role candidate lookup", () => {
    const params = normalizePublicCandidateSearchParams({
      query: `  ${"candidate ".repeat(20)}  `,
      state: "ohio",
      limit: "999",
    });

    expect(params.query).toHaveLength(80);
    expect(params.state).toBeUndefined();
    expect(params.limit).toBe(20);
  });

  it("keeps operational autofill fields but removes direct campaign contact fields", () => {
    const candidate: CandidateSuggestion = {
      id: "candidate-1",
      candidateName: "Jane Candidate",
      displayName: "Jane Candidate",
      party: "Independent",
      officeName: "Mayor",
      officeLevel: "municipal",
      state: "OH",
      jurisdictionName: "Akron",
      jurisdictionType: "city",
      districtType: "city",
      districtLabel: "Akron",
      electionName: "General Election",
      electionType: "general",
      electionDate: "2026-11-03",
      electionYear: 2026,
      filingStatus: "filed",
      campaignWebsite: "https://example.test",
      campaignEmail: "campaign@example.test",
      campaignPhone: "+15555550100",
      mapLayerHint: { layer: "city" },
      uspsRouteHint: { routeCount: 12 },
      timelineHint: { mailWindow: "fall" },
      sourceConfidence: 0.9,
      dataConfidence: "public_aggregate",
      sourceKeys: ["test"],
      score: 0.8,
    };

    const publicCandidate = toPublicCandidateSuggestion(candidate);

    expect(publicCandidate).toMatchObject({
      candidateName: "Jane Candidate",
      officeName: "Mayor",
      state: "OH",
      districtLabel: "Akron",
      electionDate: "2026-11-03",
      mapLayerHint: { layer: "city" },
    });
    expect("campaignEmail" in publicCandidate).toBe(false);
    expect("campaignPhone" in publicCandidate).toBe(false);
  });
});
