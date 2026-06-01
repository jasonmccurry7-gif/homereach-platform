-- HomeReach SEO AI Assets seed
-- Data-only, idempotent, and additive. Reuses existing AI Assets and AI Workforce tables.

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
)
select *
from (values
  (
    'Technical SEO Audit',
    'SEO audits',
    'Audit HomeReach-owned routes for crawlability, indexability, metadata, schema, internal linking, performance, and revenue-path risk.',
    array['route list','sitemap','robots','metadata','schema','analytics context']::text[],
    'Use HomeReach business context, sitemap, robots, authority routes, current metadata, schema notes, and analytics context when available. Return route-level findings, issue severity, evidence, recommended fix, risk, and human approval requirements. Do not change redirects, indexing controls, metadata, schema, or live pages without approval.',
    'Technical SEO audit, affected route, evidence, issue severity, recommended fix, approval status, next action.',
    'Human approval required before metadata, schema, redirect, indexing, or public website changes.',
    array['seo','technical-seo','approval-required']::text[],
    'active',
    'Canonical technical SEO SOP for HomeReach-owned pages.'
  ),
  (
    'Local SEO Authority Brief',
    'Local SEO',
    'Create review-ready city, county, and service-area briefs that build legitimate HomeReach local authority without doorway pages or fake local claims.',
    array['geography','service','existing pages','proof points','local source notes']::text[],
    'Create a HomeReach local authority brief using approved business facts, existing authority routes, service relevance, public local context when needed, proof gaps, internal links, and CTA. Do not fabricate offices, customers, reviews, proximity, or local dominance claims.',
    'Local SEO brief, source notes, proof gaps, internal links, CTA, approval status, next action.',
    'Human approval required before local pages, profile updates, citations, or customer-facing local claims.',
    array['seo','local-seo','authority','approval-required']::text[],
    'active',
    'Canonical local SEO authority SOP.'
  ),
  (
    'Topic Cluster Plan',
    'SEO content strategy',
    'Plan useful HomeReach topic clusters, pillar pages, supporting pages, FAQs, internal links, and refresh opportunities.',
    array['topic','audience','service','existing pages','source requirements']::text[],
    'Build a useful HomeReach topic cluster map from approved context and existing authority assets. Include search intent, pillar page, supporting pages, FAQ opportunities, internal links, proof/source needs, CTA path, and approval gates. No thin AI content, keyword stuffing, duplicate pages, or unsupported statistics.',
    'Topic cluster map, search intent, pillar/supporting briefs, internal links, source list, approval status.',
    'Human approval required before publishing or updating public SEO content.',
    array['seo','topic-cluster','content-strategy','approval-required']::text[],
    'active',
    'Canonical content/topic cluster SOP.'
  ),
  (
    'Conversion SEO Review',
    'Conversion SEO',
    'Review organic landing pages for search-intent match, proof, CTA clarity, mobile readability, and lead-path friction.',
    array['page URL','audience','offer','conversion goal','current copy','approved proof']::text[],
    'Review a HomeReach organic landing page for search intent, offer clarity, trust/proof, CTA, mobile readability, internal links, and lead path risk. Draft recommendations only. Do not alter pricing, forms, checkout, or public copy without approval.',
    'Conversion SEO review, page-section recommendations, CTA variants, proof gaps, risks, approval status.',
    'Human approval required before public copy, CTA, pricing language, form, or revenue-path changes.',
    array['seo','conversion-seo','revenue-path','approval-required']::text[],
    'active',
    'Canonical conversion SEO SOP.'
  ),
  (
    'SEO QA Review',
    'SEO QA',
    'Verify SEO outputs before implementation by checking sources, claims, metadata, internal links, local assertions, and approval status.',
    array['SEO artifact','target route','sources','verification checklist','approval state']::text[],
    'Review the SEO artifact before implementation or publication. Check source support, claims, spam risk, duplicate/thin content risk, metadata, schema, internal links, local assertions, CTA fit, brand alignment, and approval state. Block unresolved risks.',
    'SEO QA report, pass/block status, issue list, required revisions, approval status, next action.',
    'Human approval remains required after SEO QA for public changes.',
    array['seo','quality','qa','approval-required']::text[],
    'active',
    'Canonical SEO QA SOP.'
  )
) as seed(prompt_name, category, purpose, required_inputs, prompt_text, output_format, approval_requirement, tags, status, notes)
where not exists (
  select 1 from public.ai_prompt_sops existing where existing.prompt_name = seed.prompt_name
);

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
  (
    'SEO Authority Guardrails',
    'SEO examples',
    'HomeReach SEO quality rules.',
    'Create useful, source-backed, conversion-focused pages. Do not create thin AI pages, duplicate location spam, doorway pages, fake local claims, keyword stuffing, unsupported ranking guarantees, fabricated reviews, or fabricated proof.',
    array['seo','quality','guardrails']::text[],
    'seo authority',
    'local SEO',
    5,
    'active',
    'Authority and anti-spam guardrails for all SEO agents.'
  ),
  (
    'HomeReach Authority Clusters',
    'SEO examples',
    'Existing HomeReach SEO clusters and authority hubs.',
    'Ohio city pages, county pages, political mail pages, case studies, interactive tools, visual galleries, benchmark datasets, service pages, and image SEO assets should be linked into topical clusters with clear CTAs.',
    array['seo','clusters','internal-links']::text[],
    'seo authority',
    'local SEO',
    4,
    'active',
    'Source category for existing authority assets and internal linking.'
  ),
  (
    'SEO Conversion Proof Library',
    'SEO examples',
    'Proof signals for organic landing pages.',
    'Use approved examples, visuals, maps, proposal previews, testimonials, case studies, dashboard screenshots, and operational explanations only when the source is known and approved.',
    array['seo','conversion','proof']::text[],
    'conversion SEO',
    'local SEO',
    4,
    'active',
    'Source category for conversion SEO proof and trust signals.'
  )
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
  (
    'Technical SEO Agent',
    'Improve HomeReach organic visibility by finding crawlability, indexability, metadata, schema, performance, internal link, and route-level SEO issues.',
    array['audit routes','draft metadata/schema recommendations','prioritize fix lists']::text[],
    array['publish changes','change redirects/indexing without approval','keyword stuff']::text[],
    array['SEO Engine Registry','SEO Authority Guardrails','Search Console / Analytics Signals','Website Copy Source']::text[],
    array['Technical SEO Audit','SEO QA Review']::text[],
    'Human approval required before metadata, schema, redirect, indexing, or public website changes.',
    'No cloaking, no keyword stuffing, no crawler manipulation, no unsupported SEO claims.',
    'Escalate broken revenue paths, indexing risk, redirects, auth/payment routes, and high-traffic page changes.',
    'Technical SEO audit, issue severity, affected route, source evidence, recommended fix, approval status, next action.',
    'Precise, evidence-based, practical, and approval-aware.',
    array['technical issues found','approved fixes queued','crawl risks avoided','quality gates passed']::text[],
    'active',
    'Canonical SEO workforce profile.'
  ),
  (
    'Local SEO Authority Agent',
    'Build legitimate HomeReach local authority for Ohio and service-area pages without spam or fake local proof.',
    array['draft local briefs','identify proof gaps','recommend internal links']::text[],
    array['create doorway pages','fabricate offices/reviews/customers','mass-generate local spam']::text[],
    array['HomeReach Authority Clusters','SEO Authority Guardrails','Website Copy Source']::text[],
    array['Local SEO Authority Brief','SEO QA Review']::text[],
    'Human approval required before local pages, profile updates, citations, or customer-facing local claims.',
    'No fake proximity, no fake reviews, no duplicate location spam, no unsupported dominance claims.',
    'Escalate reputation issues, unsupported local proof, NAP questions, and legal/compliance claims.',
    'Local SEO brief, proof gaps, source notes, internal links, CTA, approval status, next action.',
    'Locally relevant, useful, calm, premium, and source-backed.',
    array['local briefs approved','proof gaps resolved','authority links added','spam risks avoided']::text[],
    'active',
    'Canonical SEO workforce profile.'
  ),
  (
    'Content / Topic Cluster Agent',
    'Plan useful HomeReach topic clusters, pillar pages, supporting content, FAQs, and refresh opportunities.',
    array['draft topic maps','create briefs','recommend internal links']::text[],
    array['publish thin AI content','plagiarize','invent stats or outcomes']::text[],
    array['HomeReach Authority Clusters','SEO Authority Library','SEO Quality Gates','Website Copy Source']::text[],
    array['Topic Cluster Plan','SEO Authority Asset Brief','SEO QA Review']::text[],
    'Human approval required before publishing or updating public SEO content.',
    'No thin AI content, no duplicate pages, no unsupported statistics, no ranking guarantees.',
    'Escalate customer proof gaps, regulated claims, pricing conflicts, or positioning confusion.',
    'Topic cluster map, search intent, pillar/supporting briefs, internal links, source list, approval status.',
    'Useful, specific, answer-first, human, and conversion-aware.',
    array['clusters approved','content gaps closed','internal links improved','revision rate']::text[],
    'active',
    'Canonical SEO workforce profile.'
  ),
  (
    'Conversion SEO Agent',
    'Improve organic pages so visitors understand the offer, trust HomeReach, and take the next approved action.',
    array['review page intent','draft CTA variants','flag proof gaps']::text[],
    array['alter pricing','change checkout flows','make ROI/ranking guarantees']::text[],
    array['SEO Conversion Proof Library','Pricing Page Source','Customer Reply Patterns','Website Copy Source']::text[],
    array['Conversion SEO Review','SEO Landing Page Draft','SEO QA Review']::text[],
    'Human approval required before public copy, CTA, pricing language, form, or revenue-path changes.',
    'No manipulative urgency, no unsupported ROI, no checkout/payment changes without approval.',
    'Escalate payment risk, pricing conflicts, customer proof gaps, legal claims, or broken lead paths.',
    'Conversion SEO review, page-section recommendations, CTA variants, proof gaps, risks, approval status.',
    'Clear, premium, simple, credible, and revenue-aware.',
    array['conversion issues found','approved CTA improvements','lead path risks avoided']::text[],
    'active',
    'Canonical SEO workforce profile.'
  ),
  (
    'SEO QA Agent',
    'Review SEO outputs before implementation or publication for source support, spam risk, brand alignment, and approval status.',
    array['verify sources','flag SEO risks','request revisions']::text[],
    array['publish','approve its own work as final human approval','waive gates']::text[],
    array['SEO Quality Gates','SEO Authority Guardrails','Website Copy Source']::text[],
    array['SEO QA Review','SEO Quality Review']::text[],
    'Human approval remains required after SEO QA for public changes.',
    'Do not hide unresolved risks, waive approval gates, or approve unsupported claims.',
    'Escalate unsupported claims, legal/compliance risk, indexation/redirect risk, or missing source evidence.',
    'SEO QA report, pass/block status, issue list, required revisions, approval status, next action.',
    'Direct, careful, evidence-based, and protective of HomeReach authority.',
    array['risks blocked','outputs approved after review','revision clarity','publish incidents avoided']::text[],
    'active',
    'Canonical SEO workforce profile.'
  )
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
  (
    'SEO Authority Chain',
    'SEO workflow',
    'Move local SEO work from market intent to review-ready page or authority asset without bypassing publish approval.',
    array['market','service_or_topic','search_intent','approved_offer','source_assets']::text[],
    array['SEO Engine Registry','SEO Authority Library','Local SEO Keyword Targets','SEO Quality Gates']::text[],
    array['source review','claim review','quality review','publish approval']::text[],
    'ready',
    'active',
    'Market/Intent Research -> Opportunity Brief -> Page or Asset Draft -> Metadata + Schema Plan -> Internal Link Plan -> Quality Review + Approval Handoff.'
  )
) as seed(chain_name, category, purpose, required_inputs, source_assets, approval_points, run_status, status, notes)
where not exists (
  select 1 from public.ai_prompt_chains existing where existing.chain_name = seed.chain_name
);

with step_seed(chain_name, step_order, step_name, required_inputs, source_assets, output_summary, approval_required, run_status, notes) as (
  values
    ('SEO Authority Chain', 1, 'Market/Intent Research', array['market','service_or_topic','search_intent']::text[], array['Local SEO Keyword Targets','Search Console / Analytics Signals']::text[], 'Summarize local search intent, revenue fit, and missing source inputs.', false, 'ready', 'Internal research step.'),
    ('SEO Authority Chain', 2, 'Opportunity Brief', array['market research','approved offer','source notes']::text[], array['Local SEO Authority Brief','Website Copy Source','Pricing Page Source']::text[], 'Create a source-backed SEO opportunity brief with CTA and approval risks.', true, 'ready', 'Review before drafting public claims.'),
    ('SEO Authority Chain', 3, 'Page or Asset Draft', array['approved brief','page type','audience']::text[], array['SEO Landing Page Draft','Topic Cluster Plan','HomeReach Authority Clusters']::text[], 'Draft the page, guide, case study, tool, benchmark, or visual asset plan.', true, 'ready', 'Customer-facing draft approval required.'),
    ('SEO Authority Chain', 4, 'Metadata + Schema Plan', array['draft content','target query','page type']::text[], array['SEO Authority Guardrails']::text[], 'Prepare title, description, schema notes, image SEO notes, and canonical slug recommendation.', true, 'ready', 'Quality gate.'),
    ('SEO Authority Chain', 5, 'Internal Link Plan', array['draft content','authority assets','conversion path']::text[], array['HomeReach Authority Clusters','Campaign Examples','Website Copy Source']::text[], 'Recommend internal links, CTA path, and related authority assets.', true, 'ready', 'Review for relevance and conversion fit.'),
    ('SEO Authority Chain', 6, 'Quality Review + Approval Handoff', array['draft','metadata','source notes','internal links']::text[], array['SEO QA Review','SEO Quality Gates']::text[], 'Run final quality review and hand off for human approval before publish.', true, 'ready', 'Publishing must remain human-approved.')
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
  where existing.chain_id = chains.id and existing.step_order = step_seed.step_order
);

insert into public.ai_verification_checks (label, category, status, required, notes)
select *
from (values
  ('SEO source support verified', 'seo', 'not_started', true, 'Every local claim, proof point, number, and offer statement must connect to an approved source.'),
  ('SEO metadata and schema reviewed', 'seo', 'not_started', true, 'Confirm title, description, schema notes, image SEO, and canonical slug recommendation.'),
  ('Internal links and CTA reviewed', 'seo', 'not_started', true, 'Confirm internal links are relevant and the CTA matches the approved offer.'),
  ('No thin or duplicate SEO content', 'seo', 'not_started', true, 'Block thin AI content, duplicate location pages, and doorway-page patterns.'),
  ('No keyword stuffing or doorway-page pattern', 'seo', 'not_started', true, 'Keep pages useful, natural, and tied to real HomeReach services and authority.'),
  ('Local claims verified', 'seo', 'not_started', true, 'Verify local facts, service-area language, proof, and any profile/citation implications.'),
  ('No SEO ranking or traffic guarantees', 'seo', 'not_started', true, 'Do not guarantee rankings, traffic, leads, revenue, or AI search citations.'),
  ('SEO publish approval completed', 'seo', 'not_started', true, 'Human approval required before publishing, indexing, or public use.')
) as seed(label, category, status, required, notes)
where not exists (
  select 1 from public.ai_verification_checks c where c.output_id is null and c.label = seed.label
);

insert into public.ai_workforce_tasks (
  task_id,
  workflow_name,
  requestor,
  assigned_agent,
  priority,
  status,
  input_path,
  input_data,
  expected_output,
  dependencies,
  approval_required,
  related_campaign,
  related_client,
  related_opportunity,
  completion_notes
)
select *
from (values
  (
    'WF-SEO-001',
    'SEO Authority Chain',
    'HomeReach Admin',
    'Content / Topic Cluster Agent',
    'high',
    'assigned',
    'ai-workforce/seo-content',
    '{"chain":"Market/intent research -> opportunity brief -> page or authority asset draft -> metadata/schema plan -> internal link plan -> quality review -> approval handoff"}'::jsonb,
    'Source-backed SEO opportunity brief with page type, target market, approved offer fit, internal links, CTA, quality gates, and human approval status.',
    array['Topic Cluster Plan','SEO Authority Guardrails','HomeReach Authority Clusters']::text[],
    true,
    'Local SEO authority engine',
    null,
    null,
    'SEO publishing remains approval-gated.'
  ),
  (
    'WF-SEO-TECH-001',
    'SEO Authority Chain',
    'HomeReach Admin',
    'Technical SEO Agent',
    'high',
    'assigned',
    'ai-workforce/seo-technical',
    '{"chain":"Technical audit -> sitemap/robots check -> metadata/schema review -> internal link gaps -> implementation-ready fix list","commandCenter":"/admin/marketing/seo-command-center"}'::jsonb,
    'Prioritized HomeReach technical SEO audit with affected routes, evidence, risk, owner approval gates, and next implementation actions.',
    array['SEO Command Center','Sitemap','Robots','SEO Quality Gates']::text[],
    true,
    'HomeReach organic growth',
    null,
    'Technical SEO readiness',
    'SEO changes remain review-first before public implementation.'
  ),
  (
    'WF-SEO-LOCAL-001',
    'SEO Authority Chain',
    'HomeReach Admin',
    'Local SEO Authority Agent',
    'high',
    'assigned',
    'ai-workforce/seo-local',
    '{"chain":"City/county opportunity -> proof requirements -> local authority brief -> internal links -> review queue","commandCenter":"/admin/marketing/seo-command-center"}'::jsonb,
    'Review-ready Ohio local authority brief that improves HomeReach search visibility without thin duplicate local pages.',
    array['Ohio authority routes','Political mail authority routes','Approved HomeReach business facts']::text[],
    true,
    'HomeReach local SEO authority',
    null,
    'Ohio city and county authority',
    'Local claims must be source-backed and approved before publishing.'
  ),
  (
    'WF-SEO-CONVERSION-001',
    'SEO Authority Chain',
    'HomeReach Admin',
    'Conversion SEO Agent',
    'high',
    'awaiting_approval',
    'ai-workforce/seo-growth',
    '{"chain":"Organic page intent -> proof/CTA audit -> copy recommendations -> lead path QA -> approval","commandCenter":"/admin/marketing/seo-command-center"}'::jsonb,
    'Conversion SEO review for top organic/revenue pages with CTA clarity, proof gaps, mobile notes, and lead-path risk.',
    array['SEO Command Center','Growth Engine top revenue pages','CTA Audit Agent']::text[],
    true,
    'HomeReach inbound lead flywheel',
    null,
    'Organic lead conversion',
    'CTA or public copy changes require human approval.'
  )
) as seed(task_id, workflow_name, requestor, assigned_agent, priority, status, input_path, input_data, expected_output, dependencies, approval_required, related_campaign, related_client, related_opportunity, completion_notes)
where not exists (
  select 1 from public.ai_workforce_tasks existing where existing.task_id = seed.task_id
);

insert into public.ai_workforce_activity_logs (
  task_public_id,
  agent_name,
  event_type,
  status,
  summary,
  details,
  approval_status
)
select
  'WF-SEO-SEED-001',
  'Content / Topic Cluster Agent',
  'seo_assets_seeded',
  'completed',
  'SEO AI Assets prompts, data sources, agent profiles, prompt chain, verification checks, and task seeds added to the existing command centers.',
  '{"source":"migration","human_approval_required":true}'::jsonb,
  'not_required'
where not exists (
  select 1 from public.ai_workforce_activity_logs where task_public_id = 'WF-SEO-SEED-001'
);;
