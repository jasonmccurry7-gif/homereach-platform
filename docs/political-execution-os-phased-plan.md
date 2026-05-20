# HomeReach Political Execution OS - Phased Build Plan

This plan consolidates the current HomeReach Political requirements into small, testable build phases. Everything is additive to the existing HomeReach platform and shares the same political backend.

## Phase 0 - Stabilize And Audit

- Confirm canonical migration source and remote Supabase state.
- Fix DB package exports and current typecheck blockers.
- Confirm Stripe, email, SMS, cron, feature flags, and admin auth behavior in staging.
- Checkpoint before any live provider tests.

## Phase 1 - Core Decision Engine

- Build shared strategy logic for Coverage, Precision, and Hybrid plans.
- Inputs: goal, budget, timeline, geography, district type, drop count, campaign-provided list count.
- Outputs: recommendation, why-this-plan, scenarios, cost, reach, coverage, impressions, drop schedule, coverage strength, delivery confidence.
- Wire into `/political/plan` and store compact strategy summary on lead submission.

## Phase 2 - Map And Coverage Planner

- Serve active `political_routes` to public/admin map views.
- Add route selection, household totals, coverage percent, and cost recalculation.
- Add district boundary overlays when available.
- Validate mobile map performance.

## Phase 3 - Scenario Builder

- Persist full, optimized, budget-constrained, and custom scenarios in `political_scenarios`.
- Allow save, toggle, compare, and convert to final plan.
- Snapshot selected routes through `political_route_selections`.

## Phase 4 - Budget Optimizer

- Budget to coverage mode.
- Routes to required budget mode.
- Best-value recommendation and tradeoff explanation.

## Phase 5 - Proposal, Approval, And Payment

- Generate proposal from selected scenario.
- Include map, coverage summary, pricing, schedule, terms, and payment options.
- Share via `/p/[token]`.
- Complete approve, sign, deposit/full payment, and webhook reconciliation.

## Phase 6 - Urgency, Trust, And Calendar

- Time-to-impact clock, print deadline, mail cutoff, in-home estimate.
- Political calendar inputs: election day, early voting, filing deadlines where available.
- Delivery confidence and production capacity indicators.
- Trust layer: experience, logistics expertise, case study/testimonial slots.

## Phase 7 - Multi-Wave And Revenue Expansion

- 1-5 drop builder with intro, reinforcement, closing, and GOTV structures.
- Add route expansion, additional drops, yard signs, door hangers, design, and rush options.
- Admin-only margin view.

## Phase 8 - Gap Detection And Active Coverage

- Detect uncovered route gaps inside selected geography.
- Suggest adjacent or high-efficiency routes.
- Display active booked/reserved routes and saturation indicators.
- Add deposit-backed route reservation with double-booking protection.

## Phase 9 - Outreach Engine

- Expand candidate, consultant, agency, party, and committee lead database.
- Prioritize campaign managers, consultants/agencies, then party officials.
- Add hot/warm/cold scoring from operational signals only.
- Add action center, compliant sequence tracking, message variation, response routing, and proposal triggers.

## Phase 10 - Client And Consultant Dashboards

- Campaign dashboard: active plans, drops, invoices, payment status, execution history.
- Campaign memory and relaunch/reorder.
- Consultant mode: multi-client dashboard, white-label proposals, commission tracking.

## Phase 11 - Reporting And Retention

- Post-mail reporting: households reached, drop dates, delivery windows, QR scans, response metrics if available.
- Relaunch recommendations from prior campaign configuration.

## Phase 12 - Vendor And Finance Scale

- Vendor marketplace: printers, mail houses, designers, list providers.
- Vendor assignment, performance tracking, standardized pricing.
- Dynamic pricing by volume, timeline, and demand.
- Payment plans, milestone billing, and subscription/multi-wave billing.

## Phase 13 - Failsafe Validation

- Validate route counts, pricing, address counts, campaign data, payment amounts, proposal totals, and production readiness.
- Block production handoff on validation failures.

## Phase 14 - Full End-To-End Testing

- Import -> Enrich -> Plan -> Scenario -> Quote -> Proposal -> Approve -> Sign -> Pay -> Production.
- Test public portal, admin portal, client dashboard, email/SMS safeguards, Stripe, maps, imports, proposals, and reporting.

## Phase 15 - Go Live

- Deploy only after staging passes, payments and communications are verified, maps are performant, security is checked, and rollback is ready.
