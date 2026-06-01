-- Starter AI Assets library for the HomeReach AI Assets Command Center.
-- Data-only, idempotent, and safe to rerun. These are editable starter assets,
-- not autonomous execution rules.

insert into public.ai_prompt_sops (
  prompt_name,
  category,
  purpose,
  required_inputs,
  prompt_text,
  output_format,
  approval_requirement,
  tags,
  status,
  notes
) values
  (
    'Facebook Group Post - Local Visibility',
    'Facebook group posts',
    'Draft a local, human Facebook group post that introduces a HomeReach offer without sounding corporate.',
    array['city','offer','audience','cta']::text[],
    'Use HomeReach business context and approved examples to draft a concise local Facebook group post. Keep it helpful, specific to the city, low-pressure, and focused on visibility, savings, or growth. Do not make unsupported ROI claims.',
    'Headline, post copy, CTA, compliance notes.',
    'Human approval required before posting.',
    array['social','local','approval-required']::text[],
    'active',
    'Starter SOP for local social visibility posts.'
  ),
  (
    'Facebook DM - Warm Lead Follow-Up',
    'Facebook DMs',
    'Create a short direct message for a warm local lead.',
    array['contact_name','business_name','offer','context','next_step']::text[],
    'Draft a brief Facebook DM that feels personal, references the lead context, explains the next useful step, and invites a simple reply. Avoid pressure, hype, and unsupported claims.',
    'Short DM plus optional longer version.',
    'Human approval required before sending.',
    array['dm','follow-up','approval-required']::text[],
    'active',
    'Used by outreach and follow-up workflows.'
  ),
  (
    'SMS Outreach - Opt-In Follow-Up',
    'SMS outreach',
    'Draft compliant, concise opt-in SMS follow-up.',
    array['first_name','request_context','offer','reply_option']::text[],
    'Draft one concise SMS for a contact who requested information or opted in. Identify HomeReach, keep it conversational, include a simple reply path, and include STOP language when appropriate.',
    'SMS under 320 characters plus compliance note.',
    'Human approval required until SMS program is fully approved.',
    array['sms','a2p','approval-required']::text[],
    'active',
    'Supports email-first/SMS-pending mode.'
  ),
  (
    'Email Outreach - Initial Business Offer',
    'Email outreach',
    'Create a premium first-touch email for a business lead.',
    array['business_name','contact_name','offer','pain_point','cta']::text[],
    'Write a clear first-touch HomeReach email. Lead with the business outcome, show why the offer is relevant, keep it concise, and close with one specific CTA.',
    'Subject line, email body, follow-up CTA.',
    'Human approval required before outbound sends.',
    array['email','sales','approval-required']::text[],
    'active',
    'Starter email outreach SOP.'
  ),
  (
    'Lead Follow-Up - Stale Proposal',
    'Lead follow-up',
    'Re-engage a lead with a pending proposal or quote.',
    array['lead_name','business_name','proposal_summary','last_contact','next_step']::text[],
    'Draft a helpful follow-up that reminds the lead what was discussed, makes the next step easy, and avoids guilt or pressure.',
    'Short email, SMS version, call note.',
    'Human approval required before sending.',
    array['follow-up','proposal','sales']::text[],
    'active',
    'Used for revenue recovery and proposal follow-up.'
  ),
  (
    'Objection Handling - Price Concern',
    'Objection handling',
    'Respond to cost concerns while preserving premium positioning.',
    array['objection','offer','value_points','approved_pricing']::text[],
    'Create a calm, empathetic reply that validates the price concern, reframes around business value, and offers a practical next step. Do not discount unless approved pricing explicitly includes it.',
    'Reply, talking points, next-step CTA.',
    'Human approval required before customer use.',
    array['sales','objection','pricing']::text[],
    'active',
    'Protects margin and avoids unapproved discounts.'
  ),
  (
    'Sales Call Script - Strategy Review',
    'Sales call scripts',
    'Prepare a short call script for a HomeReach strategy review.',
    array['offer','customer_type','pain_points','desired_outcome']::text[],
    'Draft a natural sales call flow that diagnoses the business need, explains the HomeReach plan simply, and closes with a specific next step.',
    'Opening, discovery questions, positioning, close.',
    'Human review required before use in new offers.',
    array['sales','call-script']::text[],
    'active',
    'Keeps sales calls consistent and human.'
  ),
  (
    'Political Campaign Planning Brief',
    'Political campaign planning',
    'Create a neutral operational campaign mail strategy brief.',
    array['campaign_name','office','geography','timeline','goal']::text[],
    'Build a neutral political mail strategy brief using only geographic, operational, and campaign-level information. Do not infer voter beliefs or create persuasion scores.',
    'Strategy summary, target geography, mail concepts, risks, next action.',
    'Human approval required before political use.',
    array['political','mail','compliance']::text[],
    'active',
    'Political safety rules are mandatory.'
  ),
  (
    'Candidate Research Summary',
    'Candidate research',
    'Summarize public candidate/campaign context for operational planning.',
    array['candidate_name','office','geography','public_sources']::text[],
    'Summarize only public, source-supported information about a candidate or campaign. Separate facts from assumptions and list missing information.',
    'Facts, strategy implications, source notes, unknowns.',
    'Human review required before customer-facing use.',
    array['political','research','source-required']::text[],
    'active',
    'No unsupported claims or sensitive profiling.'
  ),
  (
    'Postcard Creative Brief',
    'Postcard creative briefs',
    'Create a premium postcard creative brief for design or proposal use.',
    array['offer','audience','geography','goal','brand_notes']::text[],
    'Draft a design-ready postcard creative brief with front/back concept, message hierarchy, emotional strategy, CTA, compliance notes, and production considerations.',
    'Front concept, back concept, copy blocks, visual direction, CTA.',
    'Human approval required before production.',
    array['creative','postcard','design']::text[],
    'active',
    'Works for shared, targeted, and political mail with proper context.'
  ),
  (
    'Procurement Pitch',
    'Procurement pitches',
    'Explain the procurement savings dashboard in simple owner language.',
    array['business_type','spend_category','suspected_savings','cta']::text[],
    'Draft a plain-language pitch focused on saving money, reducing vendor stress, and making purchasing easier. Avoid enterprise jargon.',
    'Short pitch, email version, talking points.',
    'Human approval required before outbound use.',
    array['procurement','savings','sales']::text[],
    'active',
    'Keeps procurement positioned as savings intelligence.'
  ),
  (
    'Inventory Savings Audit',
    'Inventory savings audits',
    'Analyze procurement/inventory context and draft owner-friendly savings insights.',
    array['items','vendors','prices','deliveries','invoice_notes']::text[],
    'Review the available procurement data and identify savings, waste, vendor, delivery, and invoice risks. Show only owner-friendly recommendations and assumptions.',
    'Savings summary, top issues, recommended actions, assumptions.',
    'Human approval required before vendor or spend actions.',
    array['procurement','inventory','savings']::text[],
    'active',
    'AI may recommend, never commit spend.'
  ),
  (
    'SAM.gov Opportunity Review',
    'SAM.gov opportunity reviews',
    'Create a bid/no-bid review for a government opportunity.',
    array['opportunity','requirements','due_date','capability_fit','pricing_notes']::text[],
    'Summarize the opportunity, identify fit, risks, missing requirements, subcontractor needs, pricing considerations, and recommended next action. Do not certify compliance or submit bids.',
    'Summary, fit score rationale, risks, documents needed, next action.',
    'Human approval required for all bid and compliance decisions.',
    array['sam-gov','government-contracts','approval-required']::text[],
    'active',
    'FAR-aware support without legal certification.'
  ),
  (
    'Proposal Generation',
    'Proposal generation',
    'Generate a premium proposal draft from approved offer inputs.',
    array['customer','problem','recommended_plan','pricing','timeline','cta']::text[],
    'Draft a concise, executive-level proposal that explains the problem, recommended plan, visuals needed, pricing, timeline, and CTA. Use only approved pricing.',
    'Proposal sections, visual asset checklist, CTA.',
    'Human approval required before sending.',
    array['proposal','sales','pricing']::text[],
    'active',
    'Supports postcard, procurement, political, and service proposals.'
  ),
  (
    'Client Onboarding',
    'Client onboarding',
    'Create a simple onboarding checklist and welcome message.',
    array['client_name','services_purchased','next_steps','missing_items']::text[],
    'Draft a warm onboarding message and checklist that tells the client exactly what happens next and what HomeReach needs from them.',
    'Welcome note, checklist, timeline, owner action.',
    'Human approval required for customer-facing send.',
    array['onboarding','client-success']::text[],
    'active',
    'Keeps the customer experience calm and simple.'
  ),
  (
    'Dashboard QA',
    'Dashboard QA',
    'Review dashboard output for clarity, missing states, and broken actions.',
    array['page','workflow','expected_behavior','observed_behavior']::text[],
    'Audit the dashboard workflow and return concrete issues, severity, reproduction steps, and recommended fixes. Focus on revenue, safety, and customer simplicity.',
    'Findings, severity, affected file/route, fix recommendation.',
    'Engineering review required before code changes.',
    array['qa','dashboard','audit']::text[],
    'active',
    'Supports systematic platform hardening.'
  ),
  (
    'System Health Check',
    'System health checks',
    'Summarize system health and operational blockers.',
    array['health_signals','failed_jobs','webhooks','integrations','recent_errors']::text[],
    'Create an executive health summary with healthy, warning, broken, and needs-review systems. Include exact blockers and next action.',
    'Health summary, blockers, risks, next actions.',
    'Human review required for incident response.',
    array['system-health','control-tower']::text[],
    'active',
    'Supports daily control tower review.'
  ),
  (
    'Daily Revenue Integrity Audit',
    'Daily revenue integrity audits',
    'Find revenue leaks, stuck leads, failed payments, and owner actions.',
    array['leads','payments','proposals','messages','tasks']::text[],
    'Review daily operating data and identify revenue opportunities, stuck deals, failed payments, missed follow-ups, and owner actions. Keep it concise and action-oriented.',
    'Executive summary, top risks, top opportunities, next actions.',
    'Human approval required before customer outreach.',
    array['revenue','daily-brief','control-tower']::text[],
    'active',
    'Daily executive operating rhythm.'
  )
on conflict (prompt_name) do nothing;

insert into public.ai_data_sources (
  title,
  category,
  description,
  content,
  tags,
  related_workflow,
  related_offer,
  quality_rating,
  status,
  notes
)
select *
from (values
  ('Best Facebook Posts Library', 'Best Facebook posts', 'Approved examples of local social posts that feel human and useful.', 'Store top-performing Facebook post examples here. Include city, audience, goal, and outcome when known.', array['social','examples']::text[], 'social outreach', 'shared postcards', 4, 'active', 'Starter source record.'),
  ('Best DM Library', 'Best DMs', 'Approved direct message examples for warm outreach and follow-up.', 'Store short, conversational DM examples that produced replies or calls.', array['dm','examples']::text[], 'outreach', 'all offers', 4, 'active', 'Starter source record.'),
  ('Best SMS Library', 'Best SMS messages', 'Opt-in SMS examples and A2P-safe patterns.', 'Store compliant opt-in SMS copy with STOP/HELP language where appropriate.', array['sms','a2p']::text[], 'sms follow-up', 'all offers', 4, 'active', 'Starter source record.'),
  ('Best Email Library', 'Best emails', 'Approved email outreach, proposal, and follow-up examples.', 'Store subject lines, bodies, and response outcomes.', array['email','examples']::text[], 'email outreach', 'all offers', 4, 'active', 'Starter source record.'),
  ('Customer Reply Patterns', 'Customer replies', 'Real customer objections, questions, and buying signals.', 'Store anonymized replies and recommended response patterns.', array['replies','sales']::text[], 'reply handling', 'all offers', 4, 'active', 'Starter source record.'),
  ('Sales Call Notes', 'Sales call transcripts', 'Sales call transcripts and discovery patterns.', 'Store transcripts or summaries with objections, language, and next actions.', array['sales','calls']::text[], 'sales calls', 'all offers', 3, 'active', 'Starter source record.'),
  ('Objection Examples', 'Objection examples', 'Common objections and approved positioning responses.', 'Store price, timing, trust, and value objections with winning responses.', array['objections','sales']::text[], 'objection handling', 'all offers', 4, 'active', 'Starter source record.'),
  ('Testimonials Library', 'Testimonials', 'Approved customer proof and testimonials.', 'Store only testimonials approved for use, with source and permission notes.', array['proof','testimonials']::text[], 'proposal generation', 'all offers', 4, 'active', 'Starter source record.'),
  ('Website Copy Source', 'Website copy', 'Current approved HomeReach public copy and positioning.', 'Store active website copy sections for tone and factual consistency.', array['website','brand']::text[], 'content generation', 'all offers', 4, 'active', 'Starter source record.'),
  ('Pricing Page Source', 'Pricing pages', 'Approved pricing language and offer constraints.', 'Store current pricing, disclaimers, and approval notes. Do not invent discounts.', array['pricing','approval-required']::text[], 'proposal generation', 'all offers', 5, 'active', 'Starter source record.'),
  ('Pitch Deck Source', 'Pitch decks', 'Approved sales deck language and visual proof patterns.', 'Store deck outlines, slides, proof points, and approved claims.', array['pitch','proposal']::text[], 'sales', 'all offers', 4, 'active', 'Starter source record.'),
  ('Dashboard Screenshot Library', 'Dashboard screenshots', 'Approved screenshots for demos, proposals, and proof.', 'Store screenshot context, route, and approved use cases.', array['visuals','dashboard']::text[], 'proposal visuals', 'all offers', 3, 'active', 'Starter source record.'),
  ('Campaign Examples', 'Campaign examples', 'Shared, targeted, and political campaign examples.', 'Store campaign summaries, maps, creative, rollout notes, and outcomes when approved.', array['campaigns','examples']::text[], 'campaign planning', 'postcards', 4, 'active', 'Starter source record.'),
  ('Political Postcard Examples', 'Political postcard examples', 'Political mail creative examples and compliance notes.', 'Store neutral examples, design notes, and source/context. Do not store prohibited targeting assumptions.', array['political','creative']::text[], 'political creative', 'political mail', 4, 'active', 'Starter source record.'),
  ('Procurement Examples', 'Procurement examples', 'Savings, vendor, delivery, and invoice audit examples.', 'Store before/after savings examples, assumptions, and approved owner-facing language.', array['procurement','savings']::text[], 'procurement audit', 'procurement', 4, 'active', 'Starter source record.'),
  ('FAQ Library', 'FAQs', 'Approved answers to common buyer, client, and operational questions.', 'Store concise answers with compliance and pricing notes.', array['faq','support']::text[], 'customer support', 'all offers', 4, 'active', 'Starter source record.'),
  ('Onboarding Script Library', 'Onboarding scripts', 'Approved onboarding messages and setup checklists.', 'Store customer welcome, missing information, and next-step language.', array['onboarding','client-success']::text[], 'client onboarding', 'all offers', 4, 'active', 'Starter source record.'),
  ('Prior Winning Prompt Library', 'Prior winning prompts', 'Prompts and chains that produced strong outputs.', 'Store winning prompt text, inputs, outputs, and why it worked.', array['prompts','winning']::text[], 'prompt improvement', 'all offers', 5, 'active', 'Starter source record.')
) as seed(title, category, description, content, tags, related_workflow, related_offer, quality_rating, status, notes)
where not exists (
  select 1 from public.ai_data_sources existing where existing.title = seed.title
);

insert into public.ai_agent_profiles (
  agent_name,
  mission,
  allowed_actions,
  disallowed_actions,
  required_data_sources,
  required_prompt_sops,
  approval_rules,
  compliance_rules,
  escalation_rules,
  output_format,
  tone_rules,
  success_metrics,
  status,
  notes
)
select *
from (values
  ('Outreach Agent', 'Draft and prioritize safe outreach for leads and prospects.', array['draft messages','recommend next action','summarize lead context']::text[], array['send mass outreach','change pricing','make unsupported claims']::text[], array['Best Email Library','Best DM Library','Customer Reply Patterns']::text[], array['Email Outreach - Initial Business Offer','Facebook DM - Warm Lead Follow-Up']::text[], 'Human approval before sending.', 'No spam, no unsupported ROI, no political belief targeting.', 'Escalate high-value, angry, legal, payment, or compliance-sensitive replies.', 'Draft, rationale, risk notes, next action.', 'Human, concise, premium, direct.', array['reply rate','approved drafts','booked calls']::text[], 'active', 'Starter agent profile.'),
  ('Political Campaign Agent', 'Assist political campaign research, strategy, mail planning, and outreach drafts.', array['summarize public campaign context','draft strategy','recommend creative briefs']::text[], array['infer voter beliefs','score ideology','publish political messages','send outreach without approval']::text[], array['Political Postcard Examples','Campaign Examples']::text[], array['Political Campaign Planning Brief','Candidate Research Summary','Postcard Creative Brief']::text[], 'Human approval required for all political outputs.', 'Use geographic and operational planning only.', 'Escalate compliance, legal, finance, or targeting concerns.', 'Facts, strategy, risks, next action.', 'Neutral, strategic, compliance-aware.', array['approved campaign briefs','proposal readiness']::text[], 'active', 'Starter agent profile.'),
  ('Procurement Agent', 'Identify savings, vendor, delivery, inventory, and invoice opportunities.', array['analyze spend inputs','recommend savings','flag risks']::text[], array['place orders','switch vendors','approve spend']::text[], array['Procurement Examples','Pricing Page Source']::text[], array['Procurement Pitch','Inventory Savings Audit']::text[], 'Human approval before vendor or spend actions.', 'Label estimates and assumptions clearly.', 'Escalate spend commitments, contract terms, or vendor disputes.', 'Savings summary, assumptions, actions.', 'Simple, owner-friendly, practical.', array['savings identified','issues resolved','recommendations approved']::text[], 'active', 'Starter agent profile.'),
  ('Shared Postcard Agent', 'Support shared postcard lead generation, spot positioning, and follow-up.', array['draft posts','draft DMs','summarize city/category positioning']::text[], array['override category exclusivity','change availability','promise results']::text[], array['Best Facebook Posts Library','Campaign Examples']::text[], array['Facebook Group Post - Local Visibility','Facebook DM - Warm Lead Follow-Up']::text[], 'Human approval before outbound or public content.', 'Respect category exclusivity and approved pricing.', 'Escalate sold-out/category conflict/payment questions.', 'Post, DM, follow-up, risk notes.', 'Local, warm, practical.', array['leads generated','spots sold']::text[], 'active', 'Starter agent profile.'),
  ('Targeted Campaign Agent', 'Support targeted route campaigns and proposal-ready messaging.', array['draft campaign strategy','recommend visuals','generate follow-up drafts']::text[], array['change route logic','invent household counts','promise response rates']::text[], array['Campaign Examples','Dashboard Screenshot Library']::text[], array['Postcard Creative Brief','Proposal Generation']::text[], 'Human approval before proposal or customer send.', 'Use approved data and assumptions.', 'Escalate pricing, route, or fulfillment ambiguity.', 'Plan, visuals needed, pricing notes, next step.', 'Clear, confident, operational.', array['campaigns proposed','quotes accepted']::text[], 'active', 'Starter agent profile.'),
  ('SAM.gov Contract Agent', 'Assist government opportunity review, bid/no-bid, pricing logic, and compliance organization.', array['summarize solicitations','identify missing docs','draft response sections']::text[], array['submit bids','certify compliance','fabricate qualifications','approve pricing']::text[], array['Procurement Examples','FAQ Library']::text[], array['SAM.gov Opportunity Review','Proposal Generation']::text[], 'Human approval for every bid/compliance/pricing decision.', 'No legal certification or autonomous submission.', 'Escalate FAR, certification, cash flow, and subcontracting risk.', 'Summary, risks, checklist, next action.', 'Precise, cautious, executive.', array['opportunities qualified','risk avoided','bids organized']::text[], 'active', 'Starter agent profile.'),
  ('Client Onboarding Agent', 'Make client onboarding simple and complete.', array['draft welcome messages','summarize missing items','create onboarding checklist']::text[], array['change payment status','make guarantees']::text[], array['Onboarding Script Library','FAQ Library']::text[], array['Client Onboarding']::text[], 'Human approval before sending.', 'No payment or fulfillment claims unless verified.', 'Escalate payment, complaint, or deadline risk.', 'Welcome, checklist, timeline.', 'Calm, helpful, simple.', array['onboarding completion','missing items resolved']::text[], 'active', 'Starter agent profile.'),
  ('Follow-Up Agent', 'Identify stale leads and draft useful follow-ups.', array['prioritize follow-ups','draft messages','recommend cadence']::text[], array['send without approval','pressure customers']::text[], array['Customer Reply Patterns','Best Email Library','Best SMS Library']::text[], array['Lead Follow-Up - Stale Proposal','SMS Outreach - Opt-In Follow-Up']::text[], 'Human approval before send.', 'Respect opt-in and channel constraints.', 'Escalate replies needing owner decision.', 'Priority, draft, method, CTA.', 'Helpful, concise, low-pressure.', array['follow-ups approved','replies recovered']::text[], 'active', 'Starter agent profile.'),
  ('QA / System Health Agent', 'Audit dashboards, systems, and workflows for production issues.', array['summarize issues','recommend fixes','flag risks']::text[], array['deploy code','alter data','hide failures']::text[], array['Dashboard Screenshot Library']::text[], array['Dashboard QA','System Health Check']::text[], 'Engineering review before changes.', 'Report exact risks and evidence.', 'Escalate broken payments, auth, database, and messaging.', 'Findings, severity, steps, fix.', 'Direct, specific, evidence-based.', array['issues found','blockers cleared']::text[], 'active', 'Starter agent profile.'),
  ('Revenue Integrity Agent', 'Find revenue leaks and owner actions.', array['summarize revenue risks','prioritize opportunities','draft recovery messages']::text[], array['charge customers','change subscriptions','send without approval']::text[], array['Pricing Page Source','Customer Reply Patterns']::text[], array['Daily Revenue Integrity Audit','Lead Follow-Up - Stale Proposal']::text[], 'Owner approval for payment/customer actions.', 'No unapproved pricing or guarantees.', 'Escalate failed payments and high-value stuck deals.', 'Brief, risks, opportunities, actions.', 'Executive, concise, revenue-focused.', array['revenue recovered','risks resolved']::text[], 'active', 'Starter agent profile.'),
  ('Design Brief Agent', 'Turn strategy into approved creative briefs and visual asset instructions.', array['draft creative briefs','recommend visual hierarchy','prepare Canva/Figma prompts']::text[], array['publish final creative','claim print-ready approval']::text[], array['Political Postcard Examples','Campaign Examples','Pitch Deck Source']::text[], array['Postcard Creative Brief']::text[], 'Human approval before production or client send.', 'Use approved claims, disclaimers, and brand rules.', 'Escalate compliance, political, or production uncertainty.', 'Creative brief, copy blocks, visual direction.', 'Premium, visual, practical.', array['briefs approved','revision cycles reduced']::text[], 'active', 'Starter agent profile.')
) as seed(agent_name, mission, allowed_actions, disallowed_actions, required_data_sources, required_prompt_sops, approval_rules, compliance_rules, escalation_rules, output_format, tone_rules, success_metrics, status, notes)
where not exists (
  select 1 from public.ai_agent_profiles existing where existing.agent_name = seed.agent_name
);

insert into public.ai_prompt_chains (
  chain_name,
  category,
  purpose,
  required_inputs,
  source_assets,
  approval_points,
  run_status,
  status,
  notes
)
select *
from (values
  ('Offer Chain', 'Offer workflow', 'Turn an offer into sales assets and follow-up.', array['offer','audience','pricing','cta']::text[], array['Website Copy Source','Pricing Page Source','Best Email Library']::text[], array['pricing review','customer-facing approval']::text[], 'ready', 'active', 'Offer Architect -> Sales Page -> Sales Script -> Demo/VSL Script -> Email/SMS Follow-Up.'),
  ('Political Campaign Chain', 'Political workflow', 'Build a compliant political campaign mail plan.', array['candidate','office','geography','timeline']::text[], array['Political Postcard Examples','Campaign Examples']::text[], array['political compliance review','proposal approval']::text[], 'ready', 'active', 'Candidate Research -> Campaign Strategy -> Target Area Plan -> Postcard Creative Brief -> Proposal -> Follow-Up.'),
  ('Procurement Chain', 'Procurement workflow', 'Turn business intake into savings pitch and follow-up.', array['business','spend','vendors','pain_points']::text[], array['Procurement Examples','Pricing Page Source']::text[], array['savings assumptions review','customer-facing approval']::text[], 'ready', 'active', 'Business Intake -> Spend Analysis -> Savings Angle -> Pitch Message -> Demo Script -> Follow-Up.'),
  ('SAM.gov Chain', 'Government contracts workflow', 'Move an opportunity from scan to safe bid support.', array['opportunity','requirements','due_date','capabilities']::text[], array['FAQ Library','Pitch Deck Source']::text[], array['bid/no-bid approval','compliance approval','pricing approval']::text[], 'ready', 'active', 'Opportunity Scan -> Fit Analysis -> Bid/No-Bid -> Partner Need -> Proposal Draft -> Follow-Up.'),
  ('Shared Postcard Chain', 'Shared postcard workflow', 'Turn city/category research into local outreach and close sequence.', array['city','category','available_spots','cta']::text[], array['Best Facebook Posts Library','Best DM Library','Campaign Examples']::text[], array['public post approval','outreach approval']::text[], 'ready', 'active', 'City/Category Research -> Offer Positioning -> Facebook Post -> DM Follow-Up -> Intake Link -> Close Sequence.')
) as seed(chain_name, category, purpose, required_inputs, source_assets, approval_points, run_status, status, notes)
where not exists (
  select 1 from public.ai_prompt_chains existing where existing.chain_name = seed.chain_name
);

with step_seed(chain_name, step_order, step_name, required_inputs, source_assets, output_summary, approval_required, run_status, notes) as (
  values
    ('Offer Chain', 1, 'Offer Architect', array['offer','audience','outcome']::text[], array['Website Copy Source']::text[], 'Clarify the offer, promise, audience, and CTA.', true, 'ready', 'First offer-shaping step.'),
    ('Offer Chain', 2, 'Sales Page', array['offer brief','approved pricing']::text[], array['Website Copy Source','Pricing Page Source']::text[], 'Draft a clean sales page outline.', true, 'ready', 'Customer-facing approval required.'),
    ('Offer Chain', 3, 'Sales Script', array['offer brief','objections']::text[], array['Objection Examples','Sales Call Notes']::text[], 'Create call flow and objection handling.', true, 'ready', 'Sales enablement.'),
    ('Offer Chain', 4, 'Demo/VSL Script', array['offer brief','visual proof']::text[], array['Pitch Deck Source','Dashboard Screenshot Library']::text[], 'Create short demo or VSL script.', true, 'ready', 'Visual sales asset.'),
    ('Offer Chain', 5, 'Email/SMS Follow-Up', array['offer','lead context']::text[], array['Best Email Library','Best SMS Library']::text[], 'Generate approved follow-up drafts.', true, 'ready', 'Outbound approval required.'),
    ('Political Campaign Chain', 1, 'Candidate Research', array['candidate','office','public sources']::text[], array['Political Postcard Examples']::text[], 'Summarize public campaign context.', true, 'ready', 'Source-supported only.'),
    ('Political Campaign Chain', 2, 'Campaign Strategy', array['research','geography','timeline']::text[], array['Campaign Examples']::text[], 'Create neutral operational strategy.', true, 'ready', 'No voter belief inference.'),
    ('Political Campaign Chain', 3, 'Target Area Plan', array['geography','office','timeline']::text[], array['Campaign Examples']::text[], 'Outline geography and deployment plan.', true, 'ready', 'Geographic planning only.'),
    ('Political Campaign Chain', 4, 'Postcard Creative Brief', array['strategy','audience','phase']::text[], array['Political Postcard Examples']::text[], 'Draft mail creative brief.', true, 'ready', 'Creative approval required.'),
    ('Political Campaign Chain', 5, 'Proposal + Follow-Up', array['plan','pricing','cta']::text[], array['Best Email Library']::text[], 'Create proposal outline and follow-up.', true, 'ready', 'Human approval required.'),
    ('Procurement Chain', 1, 'Business Intake', array['business type','vendors','spend']::text[], array['Procurement Examples']::text[], 'Summarize procurement situation.', false, 'ready', 'Internal setup.'),
    ('Procurement Chain', 2, 'Spend Analysis', array['items','prices','vendors']::text[], array['Procurement Examples']::text[], 'Find savings and assumptions.', true, 'ready', 'Assumptions must be labeled.'),
    ('Procurement Chain', 3, 'Savings Angle', array['savings findings','business pain']::text[], array['Procurement Examples']::text[], 'Create owner-friendly savings positioning.', true, 'ready', 'No guaranteed savings.'),
    ('Procurement Chain', 4, 'Pitch Message', array['savings angle','cta']::text[], array['Best Email Library','Best DM Library']::text[], 'Draft outreach pitch.', true, 'ready', 'Approval before sending.'),
    ('Procurement Chain', 5, 'Demo Script + Follow-Up', array['pitch','objections']::text[], array['Sales Call Notes','Objection Examples']::text[], 'Create demo flow and follow-up.', true, 'ready', 'Sales enablement.'),
    ('SAM.gov Chain', 1, 'Opportunity Scan', array['opportunity','agency','due date']::text[], array['FAQ Library']::text[], 'Summarize opportunity and deadlines.', true, 'ready', 'No submission decisions.'),
    ('SAM.gov Chain', 2, 'Fit Analysis', array['requirements','capabilities']::text[], array['Pitch Deck Source']::text[], 'Assess capability and risk.', true, 'ready', 'Human review required.'),
    ('SAM.gov Chain', 3, 'Bid/No-Bid', array['fit analysis','pricing risk']::text[], array['Pricing Page Source']::text[], 'Recommend bid/no-bid with reasons.', true, 'ready', 'Executive approval required.'),
    ('SAM.gov Chain', 4, 'Partner/Subcontractor Need', array['requirements','gaps']::text[], array['Procurement Examples']::text[], 'Identify teaming or subcontractor needs.', true, 'ready', 'Compliance review required.'),
    ('SAM.gov Chain', 5, 'Proposal Draft + Follow-Up', array['decision','requirements','docs']::text[], array['Pitch Deck Source']::text[], 'Draft proposal sections and follow-up.', true, 'ready', 'Never submit autonomously.'),
    ('Shared Postcard Chain', 1, 'City/Category Research', array['city','category']::text[], array['Campaign Examples']::text[], 'Summarize local positioning.', false, 'ready', 'Internal planning.'),
    ('Shared Postcard Chain', 2, 'Offer Positioning', array['research','available spots']::text[], array['Website Copy Source','Pricing Page Source']::text[], 'Clarify local offer and CTA.', true, 'ready', 'Pricing approval required.'),
    ('Shared Postcard Chain', 3, 'Facebook Post', array['positioning','city']::text[], array['Best Facebook Posts Library']::text[], 'Draft local group post.', true, 'ready', 'Public post approval required.'),
    ('Shared Postcard Chain', 4, 'DM Follow-Up', array['post','lead response']::text[], array['Best DM Library']::text[], 'Draft follow-up DM.', true, 'ready', 'Outbound approval required.'),
    ('Shared Postcard Chain', 5, 'Intake Link + Close Sequence', array['lead context','cta']::text[], array['Best Email Library','Best SMS Library']::text[], 'Create close sequence and intake CTA.', true, 'ready', 'Human approval required.')
)
insert into public.ai_prompt_chain_steps (
  chain_id,
  step_order,
  step_name,
  required_inputs,
  source_assets,
  output_summary,
  approval_required,
  run_status,
  notes
)
select
  chains.id,
  step_seed.step_order,
  step_seed.step_name,
  step_seed.required_inputs,
  step_seed.source_assets,
  step_seed.output_summary,
  step_seed.approval_required,
  step_seed.run_status,
  step_seed.notes
from step_seed
join public.ai_prompt_chains chains on chains.chain_name = step_seed.chain_name
where not exists (
  select 1
  from public.ai_prompt_chain_steps existing
  where existing.chain_id = chains.id
    and existing.step_order = step_seed.step_order
);
;
