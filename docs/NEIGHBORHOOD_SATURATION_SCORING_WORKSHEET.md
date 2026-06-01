# Neighborhood Saturation Scoring Worksheet

Use this worksheet for Market Capture campaigns where the client wants repeated visibility in specific neighborhoods, ZIPs, service pockets, or route clusters.

The goal is local visibility and market familiarity. Do not promise leads, revenue, visits, sales, or attribution certainty.

## Sellable Package

- Base offer: Market Capture at $499/month management plus client-funded ad spend.
- Direct mail: quoted separately after route counts and quantity are verified.
- Starter scope: 1 to 3 primary areas.
- Expansion scope: 4 to 6 areas only if budget supports it.
- Heavy saturation: quote as a custom bundle before launch.

## Intake Fields

The Market Capture intake stores structured planning details in:

```text
market_capture_leads.metadata.neighborhood_saturation
```

Required for a clean launch:

- Target neighborhoods, ZIPs, or route clusters.
- Monthly ad budget.
- Campaign offer.
- Saturation goal.
- Direct mail quantity if postcards are requested.
- Planning notes or exclusions.

## Area Format

Preferred format:

```text
Area name | geography | priority | notes
```

Example:

```text
Highland Square | Akron OH | primary | best customer density
Firestone Park | Akron OH | secondary | seasonal push
North Canton route cluster | Main St to Applegrove | primary | postcard add-on candidate
```

## Score Factors

The Phase 1 production score is intentionally simple.

| Factor | Positive Signal | Warning Signal |
| --- | --- | --- |
| Area count | 1 to 3 focused areas | More than 6 areas |
| Budget per area | $500+/month per area | Under $250/month per area |
| Industry fit | Home services, local retail, political, real estate, med spa, dental | Low local-service fit |
| Offer readiness | Clear offer supplied | Offer missing |
| Direct mail fit | Postcards requested for the same area | Route counts unavailable |

## Score Meaning

| Score | Priority | Action |
| --- | --- | --- |
| 75-100 | High | Ready for target review and launch planning |
| 55-74 | Medium | Sellable, but review budget and area focus |
| 0-54 | Low | Tighten area, budget, offer, or timing before launch |

## Launch Rules

- Do not launch if payment is incomplete.
- Do not launch if target areas are unclear.
- Do not launch direct mail without proof approval and verified route counts.
- Do not imply individual-level tracking.
- Do not use prohibited ad targeting categories.
- Do not make claims about guaranteed leads, sales, ROI, visits, or conversion lift.

## Owner Review

Before marking the campaign ready:

- Confirm the score and missing items.
- Confirm area count matches budget.
- Confirm direct mail scope is quoted separately.
- Confirm the client approved target geography.
- Confirm all creative uses simple local visibility language.

