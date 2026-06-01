# HomeReach AI Website Assistant Service Kit

Applies to: AI Website Assistant demo requests, setup reviews, knowledge base approval, widget activation, lead capture, and monthly reporting

## Offer

AI Website Assistant helps local businesses turn website traffic into conversations and named follow-up opportunities.

Sell it as:

- A supervised AI front desk
- After-hours lead capture
- FAQ and service-area answering
- Urgent request routing
- Conversation summaries for the owner
- A gateway into Market Capture, Reputation, Local SEO, and Direct Mail

Do not sell it as an autonomous sales bot.

## Suggested Pricing

Starter Assistant:

- $299/month
- FAQ setup
- Lead capture
- Simple dashboard
- Monthly summary

Growth Assistant:

- $599/month
- Routing rules
- Review/reputation follow-up drafts
- Weekly insight summary
- Local SEO question-gap review

Revenue Assistant:

- $999+/month
- Larger knowledge base
- Multi-location support
- Priority alerts
- Strategy review
- Cross-sell into Market Capture and reputation campaigns

## What Is Ready Now

- Public service page: `/services/ai-website-assistant`
- Demo setup intake
- Contact, email, plan interest, and consent capture
- Admin setup request visibility: `/admin/ai-web-assistant`
- Client dashboard placeholder: `/ai-assistant`
- AI Workforce setup task creation in `ai_workforce_tasks`
- AI Workforce activity logging in `ai_workforce_activity_logs`
- Approval-first database model
- Knowledge base, routing rules, alerts, leads, summaries, and activity tables
- Inert demo widget script that does not capture live leads until activation

## What Requires Human Approval

Approval is required before:

- Live widget activation
- Domain approval
- Outbound email or SMS
- Appointment confirmation
- Pricing promises
- Policy exceptions
- Public review replies
- Google/profile changes
- Use of client-specific testimonial or medical/political/financial claims

## Fulfillment Workflow

1. Review demo request in `/admin/ai-web-assistant`.
2. Review the generated AI Workforce setup task.
3. Confirm business name, contact, email, phone, website, services, service areas, and plan interest.
4. Confirm the business wants Starter, Growth, or Revenue Assistant.
5. Review generated greeting, FAQs, qualification questions, restricted topics, and routing rules.
6. Ask client for missing FAQs, policy answers, emergency rules, and contact handoff preferences.
7. Mark knowledge items approved only after human review.
8. Add client domain to allowed domains.
9. Create production assistant key.
10. Confirm widget placement with the client or web developer.
11. Activate widget only after domain and content approval.
12. Review captured conversations and leads daily for the first week.
13. Send monthly summary with conversations, leads, after-hours captures, knowledge gaps, and recommended next actions.

## Result Tracking

Track:

- Demo requests
- Assistants activated
- Website conversations
- Leads captured
- After-hours leads
- Urgent handoffs
- Follow-ups needed
- Knowledge gaps
- Common questions
- Appointment requests
- Won/lost leads if the client reports outcomes

Expected outcome for a small business:

- Fewer missed website inquiries
- Faster follow-up
- Better answers to common questions
- Clearer owner visibility into website demand
- More named leads from existing traffic

Do not guarantee leads, sales, appointments, rankings, or revenue.

## Monthly Report Format

Summary:

- The assistant handled `[conversation count]` conversations.
- It captured `[lead count]` named opportunities.
- `[after-hours count]` came in outside normal business hours.
- `[urgent count]` required priority follow-up.
- The top repeated question was `[topic]`.

Recommended next actions:

- Approve/update FAQ for `[topic]`.
- Follow up with `[lead name or count]`.
- Add a stronger CTA to `[source page]`.
- Consider Market Capture or Local SEO if repeated demand appears in a service area.

## Current Limits

- Live autonomous chat is not enabled by default.
- Demo widget is intentionally inert until activation.
- Outbound follow-up remains manual/approval-gated.
- Calendar booking requires explicit rules and client approval.
- Advanced conversation AI provider wiring should be added only after first-client workflow is proven.

## Production Smoke

Run before selling or after deploy:

```bash
pnpm smoke:ai-website-assistant
```

The smoke verifies:

- Public service page loads.
- Demo widget script remains inert before activation.
- Demo request saves to `ai_web_assistants`.
- Knowledge and routing records are created.
- AI Workforce setup task is created and approval-gated.
- AI Workforce activity ledger records the handoff.

## Ready-To-Sell Definition

The service is sellable when HomeReach can:

- Capture a demo request with contact and consent.
- Create a central AI Workforce setup task.
- Review the request in admin.
- Build an approved assistant profile.
- Explain pricing clearly.
- Activate only after domain and content approval.
- Track conversations, leads, and follow-up opportunities.
- Report results without guaranteeing outcomes.
