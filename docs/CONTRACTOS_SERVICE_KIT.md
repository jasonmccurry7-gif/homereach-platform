# HomeReach ContractOS Service Kit

Status: Production manual service kit

Applies to: ContractOS public page, readiness scans, opportunity review, SAM.gov sync, document analysis, bid room preparation, proposal support, subcontractor planning, and managed bid review.

## Offer

ContractOS helps small businesses understand and pursue government contract opportunities without turning the process into a confusing bid maze.

The service is not autonomous bidding software. HomeReach uses ContractOS to help a client:

- Find relevant public opportunities.
- Understand what the government is buying.
- Decide whether an opportunity is worth pursuing.
- Identify missing documents, compliance items, subcontractor needs, and pricing risks.
- Build a review-ready bid package.
- Track deadlines and next actions.

## Value To A Small Business

Expected business outcome:

- Less wasted time chasing bad-fit contracts.
- Clearer bid/no-bid decisions.
- Better visibility into deadlines, requirements, and missing documents.
- Better pricing discipline before committing to a bid.
- Stronger proposal organization.
- More confidence when pursuing public-sector revenue.

Do not promise:

- Contract wins.
- Guaranteed awards.
- Legal compliance.
- Certification eligibility.
- Profitability on a bid.
- Submission without human approval.

## Sellable Packages

Use owner-approved Stripe prices before exposing paid checkout at scale.

- Free readiness scan: lead capture and qualification.
- ContractOS Watchtower: standard `$359/mo`, founder rate `$299/mo`; opportunity monitoring, plain-English summaries, deadline tracking, and one AI solicitation summary per month.
- ContractOS Workspace: standard `$959/mo`, founder rate `$799/mo`; readiness, watchlist, bid/no-bid scorecards, document review, bid-room planning, and five AI solicitation summaries per month.
- Proposal Assist Sprint: standard `$1,800-$3,000`, founder rate `$1,500-$2,500`; one-time AI-assisted proposal organization and draft support, with human review required.
- Managed Bid Desk: standard `$4,200-$9,000`, founder rate `$3,500-$7,500`; human-led review of fit, pricing guardrails, compliance gaps, subcontractor needs, and response package readiness.

Stripe checkout should charge founder-rate starting amounts unless the owner creates a scoped manual invoice:

- `STRIPE_CONTRACTOS_WATCHTOWER_PRICE_ID`: `$299/mo`.
- `STRIPE_CONTRACTOS_WORKSPACE_PRICE_ID`: `$799/mo`.
- `STRIPE_CONTRACTOS_PROPOSAL_ASSIST_PRICE_ID`: starts at `$1,500`.
- `STRIPE_CONTRACTOS_MANAGED_BID_PRICE_ID`: starts at `$3,500`.

All pricing, payment links, subscriptions, discounts, refunds, and package terms require owner approval.

## Current Production Behavior

Ready now:

- Public ContractOS page.
- Public dashboard with clear safety language.
- ContractOS-specific intake on the shared waitlist flow.
- AI Workforce handoff to the SAM.gov Contract Agent.
- Opportunity cards using live database records or clearly labeled sample fallback.
- Admin ContractOS command center.
- Gov Contracts admin approval authority.
- Bid rooms and response package previews.
- SAM.gov sync architecture guarded by admin/cron auth and `SAM_GOV_API_KEY`.
- USAspending.gov award context where available.
- Document text extraction and deterministic review.
- Stripe checkout shell using configured ContractOS price IDs.

Controlled or disabled by default:

- AI document analysis is owner-approved for production when `ENABLE_CONTRACTOS_AI_ANALYSIS=true` and an AI provider key exists. Keep usage monitored and every output labeled as draft / human review required.
- Paid checkout requires Stripe price IDs.
- SAM.gov live sync requires `SAM_GOV_API_KEY`.
- Bid submission remains manual and human-controlled.

## Required Feature Flags

- `ENABLE_CONTRACTOS`
- `ENABLE_CONTRACTOS_PUBLIC_DASHBOARD`
- `ENABLE_CONTRACTOS_DOCUMENT_ANALYZER`
- `ENABLE_CONTRACTOS_AI_ANALYSIS`
- `ENABLE_CONTRACTOS_BILLING`
- `ENABLE_GOV_CONTRACTS_SAM_SYNC`

Recommended production defaults:

- `ENABLE_CONTRACTOS=true`
- `ENABLE_CONTRACTOS_PUBLIC_DASHBOARD=true`
- `ENABLE_CONTRACTOS_DOCUMENT_ANALYZER=true`
- `ENABLE_CONTRACTOS_AI_ANALYSIS=true` for HomeReach production after owner approval; use `false` for conservative staging or cost-control pauses.
- `ENABLE_CONTRACTOS_BILLING=true`
- `ENABLE_GOV_CONTRACTS_SAM_SYNC=true`

## Fulfillment Workflow

1. Capture readiness request or paid workspace interest.
2. Review the AI Workforce task assigned to the SAM.gov Contract Agent.
3. Confirm business basics, services, geography, capacity, past performance, certifications, and financial guardrails.
4. Sync or manually add relevant opportunities.
5. Review fit, risk, urgency, missing documents, and source links.
6. Decide bid/no-bid with the client.
7. If pursuing, start a bid room.
8. Build requirement checklist, document list, compliance matrix, pricing guardrails, subcontractor notes, and proposal outline.
9. Prepare a response package preview.
10. Human reviews final pricing, certifications, representations, and submission method.
11. Human submits through the official portal or approved method outside automation.
12. Record submission reference, award/loss status, notes, and next action.

## Approval Gates

Human approval is required before:

- Bid/no-bid final decisions.
- Pricing commitments.
- Certifications or compliance claims.
- Subcontractor commitments.
- Customer-facing proposal delivery.
- Payment or subscription changes.
- Official bid submission.
- Award acceptance.

## Result Tracking

Track results by client and opportunity:

- Opportunities reviewed.
- Strong-fit opportunities identified.
- No-bid decisions made with rationale.
- Bid rooms created.
- Required documents completed.
- Compliance gaps resolved.
- Proposals prepared.
- Bids submitted by a human.
- Awards, losses, or follow-up status.
- Estimated pipeline value.
- Actual awarded value where known.
- Hours saved or avoided on bad-fit opportunities.

Monthly report format:

- Opportunity pipeline summary.
- Top active opportunities.
- Decisions made.
- Documents or blockers cleared.
- Upcoming deadlines.
- Risk notes.
- Recommended next actions.

## Operating Rules

- Use official solicitation sources and source links where available.
- Separate facts from assumptions.
- Label AI output as draft or review-ready only.
- Do not fabricate qualifications, certifications, experience, references, or pricing.
- Do not submit bids or bind a business through automation.
- Keep SAM.gov, legal, financial, and compliance-sensitive decisions human-controlled.

## Ready-To-Sell Definition

ContractOS is sellable when HomeReach can:

- Explain the offer simply.
- Capture a readiness or paid-support request.
- Route the request into the AI Workforce task ledger.
- Review opportunities in admin.
- Create or preview a bid room.
- Produce a human-reviewed checklist or response package.
- Track payment readiness.
- Track bid status and next action.
- Report what was reviewed, what was decided, and what happens next.

The current release supports this as a supervised/manual service. Full self-serve scale requires continued owner-approved Stripe price IDs, live SAM.gov key confirmation, and disciplined client onboarding.

## Production Smoke

Run before selling or after deploy:

```bash
pnpm smoke:contractos
```

The smoke verifies:

- Public ContractOS page and dashboard load.
- ContractOS readiness intake page loads.
- Protected admin/GovCon sync routes require auth or cron.
- Public ContractOS intake saves.
- AI Workforce task is created for the SAM.gov Contract Agent.
- Document analyzer returns Draft - Human Review Required output.
- Stripe Checkout can create a founder-rate Watchtower session and the QA session is expired when local Stripe credentials are available.
