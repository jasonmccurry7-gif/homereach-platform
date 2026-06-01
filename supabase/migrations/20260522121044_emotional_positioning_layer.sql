-- HomeReach Emotional Positioning Layer
-- Additive brand, sales psychology, and verification assets for AI workflows.

update public.ai_business_context
set
  company_overview = 'HomeReach is an AI-powered operational growth and execution ecosystem for modern local businesses and campaigns. It helps local businesses compete and grow in a world increasingly dominated by rising costs, complexity, and massive corporations.',
  brand_voice = 'Premium, calm, human, confident, practical, and operationally credible. Emotion should create relief and trust without sounding sentimental or inflated.',
  sales_positioning = 'You should not have to figure all of this out alone. HomeReach gives local operators the clarity, visibility, follow-up, savings intelligence, and execution support that usually only larger organizations can afford. Postcards are the wedge, but HomeReach is the operating ecosystem.',
  procurement_dashboard_rules = 'Frame procurement as profit protection, owner relief, and operational clarity. Translate numbers into what is leaking, what it may cost monthly, why it matters, and the simplest approval step. Never place orders, switch vendors, or commit spend without approval.',
  shared_postcard_rules = 'Frame shared postcards as premium shared local visibility, category protection, affordable exposure, and strength in coordinated local promotion. Preserve category exclusivity, available spots, payment flow, and intake flow.',
  political_mail_rules = 'Frame political mail as campaign confidence, operational superiority, execution clarity, and voter communication infrastructure. Use geography, public race context, campaign-provided data, route density, timing, cost, and logistics only. Do not infer individual voter beliefs or score ideology.',
  human_approval_requirements = 'Human approval is required for pricing changes, political/public messaging, mass outreach, legal/compliance-sensitive claims, SAM.gov submissions, customer guarantees, payment actions, vendor/spend commitments, and any outbound message.',
  tags = array(select distinct unnest(tags || array['emotional-positioning','premium-sales-psychology','mission-driven']::text[])),
  updated_at = now()
where title = 'HomeReach Master Business Context';

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
  related_workflow,
  notes
)
values
  (
    'Emotional Positioning Review',
    'Brand strategy',
    'Review any HomeReach copy, page, dashboard, outreach draft, or AI output for emotional resonance while preserving operational credibility.',
    array['target audience','current copy','offer','desired action','compliance limits']::text[],
    'Use HomeReach business context and the emotional positioning rules. Identify the current emotional weakness, missing emotional driver, improved positioning, trust proof, clearer CTA, urgency if appropriate, and verification risks. Keep the result premium, calm, specific, and operationally credible.',
    'Return: weakness, missing driver, revised copy, CTA, trust proof, risk notes, approval requirement.',
    'Human approval required before public, outbound, political, pricing, legal, or customer-facing use.',
    array['emotional-positioning','copy-review','human-approval']::text[],
    'active',
    'Emotional Positioning',
    'Added by emotional positioning layer.'
  ),
  (
    'Shared Postcard Emotional Outreach',
    'Shared postcards',
    'Create shared postcard Facebook posts, DMs, emails, SMS drafts, and onboarding copy that speaks to affordable visibility and local business pressure.',
    array['city','category','business type','available spots','CTA','proof asset']::text[],
    'Open with a real local visibility pressure. Position shared postcards as premium mailbox presence without forcing one business to carry the full cost. Mention category protection when relevant. Avoid fake support-local language, hype, and unsupported response claims.',
    'Return short post, long post, DM, email, SMS, CTA, approval notes.',
    'Human approval required before posting or sending.',
    array['shared-postcards','facebook','dm','email','sales-psychology']::text[],
    'active',
    'Shared Postcard Chain',
    'Added by emotional positioning layer.'
  ),
  (
    'Procurement Profit Protection Report',
    'Procurement',
    'Turn supplier, invoice, delivery, and inventory data into owner-friendly savings reports that feel like relief and margin protection.',
    array['vendors','items','prices','delivery fees','invoice notes','recommended action']::text[],
    'Explain what profit may be quietly leaking, why it matters, estimated monthly impact, difficulty, operational impact, and the safest approval step. Do not sound like ERP software. Do not commit spend or vendor changes.',
    'Return issue, estimated impact, owner-friendly explanation, next action, approval requirement.',
    'Human approval required before vendor, ordering, pricing, or spend actions.',
    array['procurement','savings','margin-protection','owner-relief']::text[],
    'active',
    'Procurement Chain',
    'Added by emotional positioning layer.'
  ),
  (
    'Political Campaign Confidence Narrative',
    'Political campaign planning',
    'Create compliant campaign mail messaging that builds confidence, momentum, and operational clarity without prohibited targeting.',
    array['candidate or committee','race','geography','timing','budget','approved message frame']::text[],
    'Position HomeReach as campaign execution infrastructure. Emphasize clarity, speed, map-backed planning, production readiness, and human approval. Use geography, public context, campaign-provided data, timing, cost, and logistics only. Do not infer voter beliefs or create ideological scoring.',
    'Return campaign narrative, plan summary, postcard angle, CTA, compliance notes.',
    'Human approval required before political/public use.',
    array['political','campaign-confidence','compliance','mail']::text[],
    'active',
    'Political Campaign Chain',
    'Added by emotional positioning layer.'
  ),
  (
    'Dashboard Microcopy Confidence QA',
    'Dashboard QA',
    'Improve dashboard labels, empty states, alerts, and next-action text so users know what matters now.',
    array['dashboard route','user role','current labels','primary action','risk level']::text[],
    'For each screen, answer what the user needs to know right now. Replace operational jargon with simple labels that preserve proof and action. Use relief, clarity, control, and confidence. Do not hide material risk.',
    'Return revised labels, empty states, alert copy, CTA copy, risk notes.',
    'Human approval required before broad public or customer-facing release.',
    array['dashboard','microcopy','qa','clarity']::text[],
    'active',
    'Dashboard QA',
    'Added by emotional positioning layer.'
  )
on conflict (prompt_name) do update
set
  category = excluded.category,
  purpose = excluded.purpose,
  required_inputs = excluded.required_inputs,
  prompt_text = excluded.prompt_text,
  output_format = excluded.output_format,
  approval_requirement = excluded.approval_requirement,
  tags = excluded.tags,
  status = excluded.status,
  related_workflow = excluded.related_workflow,
  notes = excluded.notes,
  updated_at = now();

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
from (
  values
    (
      'HomeReach Emotional Positioning System',
      'Website copy',
      'Master emotional and mission-driven positioning source.',
      'HomeReach helps local businesses compete and grow in a world increasingly dominated by rising costs, complexity, and massive corporations. Core emotions: relief, protection, growth, confidence, clarity, control, pride, community, and operational superiority.',
      array['emotional-positioning','mission','brand-voice']::text[],
      'Emotional Positioning',
      null,
      5,
      'active',
      'Added by emotional positioning layer.'
    ),
    (
      'Shared Postcard Mission Copy Bank',
      'Best Facebook posts',
      'Reusable emotional framework for shared postcard sales and outreach.',
      'Open with the visibility pressure local businesses feel. Position shared postcards as premium shared mailbox presence, category protection, affordable exposure, and strength in coordinated local promotion. Avoid fake support-local cliches.',
      array['shared-postcards','facebook','dm','visibility']::text[],
      'Shared Postcard Chain',
      'Shared postcards',
      5,
      'active',
      'Added by emotional positioning layer.'
    ),
    (
      'Procurement Profit Protection Language',
      'Procurement examples',
      'Reusable language for savings intelligence, owner relief, and margin protection.',
      'Most businesses do not know how much profit quietly disappears through purchasing inefficiencies, supplier price drift, delivery fees, invoice mismatches, and reorder timing. HomeReach helps owners keep more of what they already earn.',
      array['procurement','savings','margin-protection']::text[],
      'Procurement Chain',
      'Inventory and procurement dashboard',
      5,
      'active',
      'Added by emotional positioning layer.'
    ),
    (
      'Political Campaign Confidence Language',
      'Political postcard examples',
      'Reusable language for campaign confidence, operational superiority, and compliant mail planning.',
      'Campaigns lose when execution breaks down. HomeReach helps campaigns plan geography, pricing, creative, timing, approvals, and production through a clearer command workflow. Confidence comes from disciplined execution, not risky targeting shortcuts.',
      array['political','campaign-confidence','compliance']::text[],
      'Political Campaign Chain',
      'Political mail',
      5,
      'active',
      'Added by emotional positioning layer.'
    )
) as source(title, category, description, content, tags, related_workflow, related_offer, quality_rating, status, notes)
where not exists (
  select 1 from public.ai_data_sources existing where existing.title = source.title
);

update public.ai_agent_profiles
set
  tone_rules = trim(tone_rules || ' Recognize the user pressure first, translate operational data into relief/protection/confidence/momentum, keep claims factual, and preserve human approval.'),
  updated_at = now()
where status = 'active'
  and tone_rules not ilike '%Recognize the user pressure first%';

insert into public.ai_verification_checks (label, category, status, required, notes)
select label, 'emotional-positioning', 'not_started', true, 'Added by emotional positioning layer.'
from (
  values
    ('Emotional pressure acknowledged'),
    ('Next action feels simpler and safer'),
    ('Operational proof preserved'),
    ('No fake urgency or hype'),
    ('CTA is premium and low-friction')
) as checks(label)
where not exists (
  select 1
  from public.ai_verification_checks existing
  where existing.output_id is null
    and existing.label = checks.label
);;
