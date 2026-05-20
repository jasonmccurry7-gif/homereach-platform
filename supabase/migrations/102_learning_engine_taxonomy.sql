-- HomeReach Migration 102 - Learning Engine taxonomy expansion
--
-- Purpose:
--   * Expand the existing Content Intelligence topic taxonomy into the broader
--     HomeReach Learning Engine.
--   * Keep all output review-only. This migration only adds/refreshes search
--     terms; it does not publish, send, bill, order, bid, or deploy anything.
--   * Safe to rerun through ON CONFLICT.

insert into ci_category_topics (category, search_term, priority_score) values
  -- shared postcards
  ('shared_postcards', 'shared postcard advertising strategy', 5),
  ('shared_postcards', 'direct mail postcard offer examples', 5),
  ('shared_postcards', 'local business postcard marketing ideas', 4),
  ('shared_postcards', 'postcard advertising conversion tactics', 4),

  -- targeted campaigns
  ('targeted_campaigns', 'targeted direct mail campaign strategy', 5),
  ('targeted_campaigns', 'EDDM vs targeted direct mail', 5),
  ('targeted_campaigns', 'route based direct mail marketing', 4),
  ('targeted_campaigns', 'neighborhood saturation direct mail', 4),

  -- political
  ('political', 'political direct mail strategy', 5),
  ('political', 'campaign postcard examples', 5),
  ('political', 'GOTV direct mail best practices', 4),
  ('political', 'political campaign operations dashboard', 4),

  -- procurement
  ('procurement', 'AI procurement automation small business', 5),
  ('procurement', 'supplier cost reduction strategy', 5),
  ('procurement', 'inventory purchasing automation', 4),
  ('procurement', 'vendor price monitoring workflow', 4),

  -- outreach
  ('outreach', 'AI outbound sales system', 5),
  ('outreach', 'cold email follow up automation', 5),
  ('outreach', 'SMS sales follow up best practices', 4),
  ('outreach', 'AI appointment setting workflow', 4),

  -- SEO
  ('seo', 'AI SEO content engine', 5),
  ('seo', 'local SEO landing page strategy', 5),
  ('seo', 'programmatic SEO small business', 4),
  ('seo', 'SEO content workflow automation', 4),

  -- inventory
  ('inventory', 'inventory dashboard UX small business', 5),
  ('inventory', 'predictive inventory management AI', 5),
  ('inventory', 'stockout alert workflow', 4),
  ('inventory', 'vendor scorecard dashboard', 4),

  -- AI agents
  ('ai_agents', 'AI agent operating system', 5),
  ('ai_agents', 'multi agent workflow orchestration', 5),
  ('ai_agents', 'AI digital employee architecture', 5),
  ('ai_agents', 'human in the loop AI agents', 4),

  -- revenue
  ('revenue', 'AI revenue operations system', 5),
  ('revenue', 'sales pipeline automation AI', 5),
  ('revenue', 'lead scoring workflow automation', 4),
  ('revenue', 'customer journey revenue dashboard', 4),

  -- executive operations
  ('executive_operations', 'AI executive dashboard', 5),
  ('executive_operations', 'business operating system dashboard', 5),
  ('executive_operations', 'daily executive briefing automation', 4),
  ('executive_operations', 'operations command center UX', 4),

  -- system reliability
  ('system_reliability', 'AI system observability dashboard', 5),
  ('system_reliability', 'automation failure monitoring', 5),
  ('system_reliability', 'workflow health dashboard', 4),
  ('system_reliability', 'agent audit logging architecture', 4),

  -- automation
  ('automation', 'business process automation ideas', 5),
  ('automation', 'AI workflow automation for small business', 5),
  ('automation', 'Zapier Make AI automation workflows', 4),
  ('automation', 'approval workflow automation', 4),

  -- dashboard UX
  ('dashboard_ux', 'AI dashboard UX design', 5),
  ('dashboard_ux', 'command center dashboard design', 5),
  ('dashboard_ux', 'simple SaaS dashboard UX', 4),
  ('dashboard_ux', 'next best action dashboard', 4),

  -- government contracts
  ('gov_contracts', 'SAM.gov opportunity monitoring', 5),
  ('gov_contracts', 'government contract bid workflow', 5),
  ('gov_contracts', 'subcontractor RFQ process', 4),
  ('gov_contracts', 'federal contracting proposal automation', 4),

  -- creative
  ('creative', 'AI postcard design workflow', 5),
  ('creative', 'Canva automation for business', 5),
  ('creative', 'AI presentation generation workflow', 4),
  ('creative', 'creative approval workflow dashboard', 4),

  -- sales scaling
  ('sales_scaling', 'AI sales playbook', 5),
  ('sales_scaling', 'B2B sales follow up system', 5),
  ('sales_scaling', 'sales objection handling scripts', 4),
  ('sales_scaling', 'lead nurture sequence examples', 4)
on conflict (category, search_term) do update set
  priority_score = excluded.priority_score,
  active_flag = true;
