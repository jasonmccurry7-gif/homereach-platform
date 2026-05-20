-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach — Seed: High-Intent Targeting Pitch Scripts
--
-- Seeds 7 curated Q&A knowledge entries agents can retrieve by natural-
-- language query (handled by the existing Q&A retrieval system).
--
-- This is PURELY a content seed. No schema changes. No pricing changes.
-- No Stripe touched. Scripts are stored as official answers so the retrieval
-- system will prefer them over ad-hoc generations.
--
-- Placeholders: scripts use {{category}} / {{service}} / {{first_name}} /
-- {{agent_first_name}} — agents can fill in at send time.
--
-- SAFE TO RE-RUN: wrapped in IF NOT EXISTS checks on question_text.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_admin_id uuid;
  v_q_id     uuid;
  v_a_id     uuid;
  v_exists   boolean;
begin
  -- Find an admin profile to attribute these seeds to
  select id into v_admin_id from profiles where role = 'admin' limit 1;
  if v_admin_id is null then
    raise exception 'No admin profile found. Create an admin via /admin before seeding.';
  end if;

  -- ── 1. Main discovery pitch ────────────────────────────────────────────────
  select exists (select 1 from qa_questions where question_text = 'How do I pitch high-intent targeting to a new prospect?') into v_exists;
  if not v_exists then
    insert into qa_questions (asked_by_agent_id, question_text, category_tags, visibility, status, is_pinned)
    values (v_admin_id, 'How do I pitch high-intent targeting to a new prospect?',
            array['high-intent-pitch','positioning','discovery','sales-script'], 'team', 'resolved', true)
    returning id into v_q_id;

    insert into qa_answers (question_id, source, author_agent_id, direct_answer, what_to_say, what_to_do_next, why_this_works, is_official)
    values (v_q_id, 'admin', v_admin_id,
      'Open with discovery. Ask how they currently target. Position HomeReach as precision targeting — homes most likely to need them now, not mass marketing. Offer a 10-minute look.',
      jsonb_build_object(
        'dm',    'Hey {{first_name}} — quick question. Are you targeting specific neighborhoods right now, or running broader campaigns? We''ve been helping {{category}} businesses hit only the homeowners most likely to need them this month — based on real property and demand signals. Been outperforming traditional mail pretty significantly. Worth 10 minutes to show you?',
        'sms',   'Hey {{first_name}} — we''re helping local {{category}} companies target only high-probability homes right now (not mass mail). Results are strong. Can I send a quick example for your ZIP?',
        'email', E'Subject: Targeting the right homes (not just more of them)\n\nHey {{first_name}},\n\nMost direct mail wastes money hitting people who don''t need the service.\n\nWe built a system that identifies homeowners most likely to need {{service}} *right now* — using real property data and demand signals (storm activity, roof age proxies, recent moves, etc.).\n\nThat means:\n  • Fewer wasted impressions\n  • Higher response rates\n  • Better ROI per piece mailed\n\nI can show you 3 scored addresses in your service area on a 10-minute call. Worth a look?\n\n— {{agent_first_name}}',
        'call',  'Hey {{first_name}}, {{agent_first_name}} from HomeReach. Real quick — are you currently targeting specific homeowners who are likely to need {{service}}, or are you running broader campaigns? [pause — let them answer] … The reason I ask is we''ve built a system that scores individual homes on likelihood to need your service this month. I''d love to show you 3 real scored addresses in your ZIP and see if it clicks. Got 10 minutes this week?'
      ),
      'Get a 10-minute discovery call booked. On the call, pull 3 real scored addresses from sales_leads for their ZIP and walk them through the scoring signals. Close on "want this for your next campaign?"',
      'Most competitors pitch "more impressions" or "more homes." You pitch "fewer, better prospects." That inversion does the heavy lifting. The discovery question also surfaces their current marketing frustration without you having to introduce the pain.',
      true)
    returning id into v_a_id;

    insert into qa_knowledge_entries (source_question_id, source_answer_id, title, body, category_tags)
    values (v_q_id, v_a_id, 'High-Intent Targeting — Discovery Pitch',
      'Use this as the standard opener when prospecting {{category}} businesses. Leads with a discovery question rather than a pitch, positions HomeReach against mass-mail competitors (Valpak, Money Mailer, PostcardMania) by emphasizing precision and waste reduction. Scripts for DM, SMS, email, and call.',
      array['high-intent-pitch','positioning','discovery','sales-script']);
  end if;

  -- ── 2. Objection: "Sounds expensive" ──────────────────────────────────────
  select exists (select 1 from qa_questions where question_text = 'Prospect said "sounds expensive" — how do I handle it?') into v_exists;
  if not v_exists then
    insert into qa_questions (asked_by_agent_id, question_text, category_tags, visibility, status, is_pinned)
    values (v_admin_id, 'Prospect said "sounds expensive" — how do I handle it?',
            array['objection','objection-price','high-intent-pitch'], 'team', 'resolved', false)
    returning id into v_q_id;

    insert into qa_answers (question_id, source, author_agent_id, direct_answer, what_to_say, what_to_do_next, why_this_works, is_official)
    values (v_q_id, 'admin', v_admin_id,
      'Reframe from price to efficiency. You''re paying to reach fewer, better prospects instead of burning money broadly. Use a concrete number if you have one.',
      jsonb_build_object(
        'sms',  'Totally hear you. Think of it this way: we''re not more expensive *per campaign* — we''re cheaper *per customer acquired*, because 60%+ of mass-mail impressions land on people who''ll never book you.',
        'email', E'Fair pushback. Quick reframe:\n\nMost mass-mail is priced per piece sent. Ours is priced per *qualified* home reached.\n\nIf a 1,000-piece Valpak drop at $400 gets you 2 customers (~$200 CAC), and our 300-piece high-intent drop at $450 gets you 4 (~$112 CAC) — you''re paying less per actual customer, not more.\n\nWant me to run the math with your actual numbers?',
        'call', 'Yeah, I hear that a lot. The thing is — it''s not really apples to apples. A $400 mass drop that gets 2 customers is $200 per customer. Our $450 high-intent drop going to 300 of the best homes in the area averages 4–6 customers. So you''re actually paying less per acquired customer, not more. Want me to run your numbers?',
        'dm',   'Hear you — reframe: we''re not more expensive per campaign, we''re cheaper per *customer acquired*. Happy to run the math with your current CAC.'
      ),
      'Ask for their current mass-mail spend and estimated customers-per-campaign. Run a side-by-side CAC comparison. The objection usually dies when they see per-customer cost.',
      'Prospects anchor on campaign cost ($400 vs $450). The winning frame is cost-per-acquired-customer, where precision targeting almost always wins. Make them do the math once and the objection goes away forever.',
      true)
    returning id into v_a_id;

    insert into qa_knowledge_entries (source_question_id, source_answer_id, title, body, category_tags)
    values (v_q_id, v_a_id, 'Objection: "Sounds Expensive"',
      'Reframe from per-campaign price to per-acquired-customer cost. Mass mail looks cheaper until you divide by actual conversions. Use this whenever price is the objection.',
      array['objection','objection-price','cac-reframe']);
  end if;

  -- ── 3. Objection: "We already do marketing" ────────────────────────────────
  select exists (select 1 from qa_questions where question_text = 'Prospect said "we already do marketing" — how do I handle it?') into v_exists;
  if not v_exists then
    insert into qa_questions (asked_by_agent_id, question_text, category_tags, visibility, status, is_pinned)
    values (v_admin_id, 'Prospect said "we already do marketing" — how do I handle it?',
            array['objection','objection-existing-vendor','high-intent-pitch'], 'team', 'resolved', false)
    returning id into v_q_id;

    insert into qa_answers (question_id, source, author_agent_id, direct_answer, what_to_say, what_to_do_next, why_this_works, is_official)
    values (v_q_id, 'admin', v_admin_id,
      'Agree fast, then differentiate. Most marketing casts a wide net — HomeReach only targets homes with active buying signals. Ask them what they''d do differently if they only paid for qualified homes.',
      jsonb_build_object(
        'sms',  'Love it — that means you''re already investing in growth. Quick diff: most marketing casts a wide net. We only hit homes with active buying signals (storm data, property age, recent moves). Worth a look as a supplement, not a replacement?',
        'email', E'Good — that means you''re serious about growth.\n\nHere''s the difference: most marketing is "reach more people and hope some need it." We run the opposite play — we only send to homes that data says are likely to need {{service}} right now.\n\nThink of it as a supplement to your current mix, not a replacement. Small test run on 200–300 of your best ZIPs usually shows within 2 weeks.\n\nOpen to a 10-min look?',
        'call', 'That''s actually perfect — most of our best clients were already running marketing. The difference is most marketing is spray-and-pray. What we do only hits homes with real buying signals — storm data, property age, recent activity. Think of it like supplement, not replacement. Would you be open to a small test run on one of your best ZIPs?',
        'dm',   'Good — you''re already investing. Quick diff: most marketing casts a wide net. We only hit homes with active buying signals. Usually runs alongside, not instead of. Worth a small test?'
      ),
      'Frame as "supplement, not replacement." Offer a small pilot (200–300 homes) to lower the commitment. Ask which of their existing campaigns has been underperforming — that''s usually where the precision play wins.',
      'Direct competition with their current vendor = lost deal. Positioning as a complement removes the either/or trap. Once they see the numbers on a pilot, the conversation shifts naturally.',
      true)
    returning id into v_a_id;

    insert into qa_knowledge_entries (source_question_id, source_answer_id, title, body, category_tags)
    values (v_q_id, v_a_id, 'Objection: "We Already Do Marketing"',
      'Agree fast, differentiate on precision, offer a small pilot instead of replacing their current vendor. Key line: "supplement, not replacement."',
      array['objection','objection-existing-vendor','pilot-offer']);
  end if;

  -- ── 4. Objection: "Does it actually work?" ─────────────────────────────────
  select exists (select 1 from qa_questions where question_text = 'Prospect asked "does it actually work?" — how do I answer?') into v_exists;
  if not v_exists then
    insert into qa_questions (asked_by_agent_id, question_text, category_tags, visibility, status, is_pinned)
    values (v_admin_id, 'Prospect asked "does it actually work?" — how do I answer?',
            array['objection','objection-proof','high-intent-pitch'], 'team', 'resolved', false)
    returning id into v_q_id;

    insert into qa_answers (question_id, source, author_agent_id, direct_answer, what_to_say, what_to_do_next, why_this_works, is_official)
    values (v_q_id, 'admin', v_admin_id,
      'Don''t sell the tech. Sell the signal. Show 3 real scored addresses in their ZIP, explain why each scored high (recent storm, roof age proxy, etc.), and let the proof speak.',
      jsonb_build_object(
        'sms',  'Fair question. Fastest way to show you: pick a ZIP in your service area, I''ll pull our 3 highest-scored addresses there right now and walk you through why each one scored high. Want to do that?',
        'email', E'Best way I can answer that is with real data from your area.\n\nPick a ZIP you''re targeting and I''ll pull our 3 highest-scored addresses there — along with the signals that drove the score (storm activity, property age proxy, recent move indicators, etc.).\n\nIf those 3 addresses don''t look like homes that would realistically need {{service}}, we shouldn''t work together.\n\nWant me to pull them?',
        'call', 'Great question. The honest answer is: it works when the signals are real. Here''s what I''d propose — give me a ZIP in your service area right now. I''ll pull our 3 highest-scored addresses in that ZIP and walk you through *why* each one scored high. If the logic doesn''t resonate, we''re not a fit. Fair?',
        'dm',   'Fair question. Best proof: pick a ZIP, I''ll pull our 3 highest-scored addresses there + the signals behind each. If the logic doesn''t resonate we''re not a fit. Want to try?'
      ),
      'Get a real ZIP on the call. Open /admin/sales-engine or /admin/content-intel, filter sales_leads by that ZIP with signal_tier=high, screenshot or screen-share 3 rows, walk through the scoring inputs for each.',
      'Generic "we use AI" claims are suspect. Specific "here are 3 addresses in YOUR ZIP and why they scored high" is immediately credible. Lean on the data we already have — don''t abstract it.',
      true)
    returning id into v_a_id;

    insert into qa_knowledge_entries (source_question_id, source_answer_id, title, body, category_tags)
    values (v_q_id, v_a_id, 'Objection: "Does It Actually Work?"',
      'Never sell the tech. Sell concrete signals on real addresses in the prospect''s ZIP. Use /admin/sales-engine or /admin/content-intel to pull live examples.',
      array['objection','objection-proof','live-demo']);
  end if;

  -- ── 5. Three-tier value positioning (1-pager) ──────────────────────────────
  select exists (select 1 from qa_questions where question_text = 'What are the three HomeReach targeting tiers and how do I explain them?') into v_exists;
  if not v_exists then
    insert into qa_questions (asked_by_agent_id, question_text, category_tags, visibility, status, is_pinned)
    values (v_admin_id, 'What are the three HomeReach targeting tiers and how do I explain them?',
            array['positioning','tiers','pricing-context'], 'team', 'resolved', true)
    returning id into v_q_id;

    insert into qa_answers (question_id, source, author_agent_id, direct_answer, what_to_say, what_to_do_next, why_this_works, is_official)
    values (v_q_id, 'admin', v_admin_id,
      'Three tiers: Standard Targeted (baseline route mail), High-Intent Targeting (scored addresses only, ~30-60% premium), Exclusive Dominance (sole {{category}} in a route, 2-3x baseline). Explain in terms of who gets less waste, not who pays more.',
      jsonb_build_object(
        'email', E'Three ways we can run campaigns for you:\n\n1) STANDARD TARGETED — baseline route mail. Best for broad awareness pushes.\n\n2) HIGH-INTENT TARGETING — we only mail scored addresses with active demand signals (storm activity, property age, recent moves, etc.). Smaller list, higher response. Typical premium: 30-60%.\n\n3) EXCLUSIVE DOMINANCE — you''re the only {{category}} business in the campaign for that route. Full market ownership for the drop window. Typical: 2-3x baseline.\n\nMost clients start at tier 2. Tier 3 is for aggressive growth windows (new market, post-storm, launch promo).',
        'call', 'Three flavors. One — standard route mail, same as Valpak basically. Two — high-intent targeting, only scored addresses with real demand signals, usually 30-60% more but way less waste. Three — exclusive, you''re the only {{category}} in the drop, 2-3x baseline, but you own the market for that window. Most start at tier two.',
        'sms',  '3 tiers: (1) standard route mail, (2) high-intent scored addresses only (30-60% premium, way less waste), (3) exclusive — only {{category}} in the drop (2-3x, full market ownership). Most start at 2.',
        'dm',   '3 options: standard route mail / high-intent scored-only (+30-60% but way less waste) / exclusive market lock (2-3x, you''re the only {{category}}). Most start at tier 2.'
      ),
      'If they''re at tier 1 today, propose a pilot at tier 2 with a clear 2-week success metric. If they''re already sophisticated, lead with tier 3 as an aggressive-growth play. Anchor high, negotiate to the middle.',
      'Three tiers anchor perception. Tier 3 exists to make tier 2 feel reasonable, and it''s a real product for serious operators. Discussing price as waste-reduction shifts the frame from "expensive" to "efficient."',
      true)
    returning id into v_a_id;

    insert into qa_knowledge_entries (source_question_id, source_answer_id, title, body, category_tags)
    values (v_q_id, v_a_id, 'Positioning: Three Targeting Tiers',
      'Standard / High-Intent / Exclusive Dominance. Anchor high, sell the middle. Frame price as waste reduction, not expense. Tier 3 exists in part to make tier 2 feel reasonable.',
      array['positioning','tiers','anchoring']);
  end if;

  -- ── 6. Data-backed framing ────────────────────────────────────────────────
  select exists (select 1 from qa_questions where question_text = 'What data signals do we actually use and how do I explain them without getting too technical?') into v_exists;
  if not v_exists then
    insert into qa_questions (asked_by_agent_id, question_text, category_tags, visibility, status, is_pinned)
    values (v_admin_id, 'What data signals do we actually use and how do I explain them without getting too technical?',
            array['data-signals','positioning','proof'], 'team', 'resolved', false)
    returning id into v_q_id;

    insert into qa_answers (question_id, source, author_agent_id, direct_answer, what_to_say, what_to_do_next, why_this_works, is_official)
    values (v_q_id, 'admin', v_admin_id,
      'Four signal buckets: recency (how recently we contacted them), engagement (did they reply, did they show buying intent), storm-fit (active severe-weather alerts in their state for roofing/gutters), category-fit (do they fall in our 6 active verticals). Scored 1-5 each, summed 4-20. 15+ = high priority.',
      jsonb_build_object(
        'email', E'Four signals, each scored 1-5:\n\n• RECENCY — how recently they''ve been contacted or first entered our system\n• ENGAGEMENT — did they reply? Any buying-signal cues in the conversation?\n• STORM-FIT — active NOAA severe-weather alerts in their state (for roofing + gutters this is huge)\n• CATEGORY-FIT — match to active HomeReach verticals (pressure washing, lawn care, window, gutter, pest, roofing)\n\nSum 4-20. 15+ = high priority, your list we''d mail first.\n\nWe re-score the entire book daily, so the list you get is fresh within 24 hours.',
        'call', 'Four signals, each 1-5. Recency — how fresh the lead is. Engagement — did they reply, any buying intent. Storm-fit — active NOAA severe-weather alerts, huge for roofing. And category-fit — match to our verticals. Sum to 4-20. 15+ means we''d mail them first. We re-score daily, so it''s always fresh.',
        'sms',  '4 signals: recency, engagement, storm-fit (NOAA live data), category-fit. Summed 4-20. 15+ = mail-first tier. Re-scored daily.',
        'dm',   '4 signals scored 1-5 each: recency (fresh lead), engagement (replied?), storm-fit (live NOAA alerts — huge for roofing), category-fit (our 6 verticals). Summed 4-20. 15+ = priority.'
      ),
      'On the call, open /admin/sales-engine → Pipeline tab → sort by signal_score desc. Show them the top 5 rows and the score breakdown. Visceral proof beats any deck.',
      'Prospects assume "AI scoring" means a black box. Naming the four signals by plain English — recency, engagement, storm-fit, category-fit — makes it feel real and auditable. "Re-scored daily" quiets the "is it stale?" worry.',
      true)
    returning id into v_a_id;

    insert into qa_knowledge_entries (source_question_id, source_answer_id, title, body, category_tags)
    values (v_q_id, v_a_id, 'Data Signals — Plain English',
      'Four signal buckets agents can explain without invoking "AI magic": recency, engagement, storm-fit, category-fit. Each 1-5, summed 4-20.',
      array['data-signals','positioning','proof']);
  end if;

  -- ── 7. Core value-positioning line ────────────────────────────────────────
  select exists (select 1 from qa_questions where question_text = 'What is the one-sentence positioning for HomeReach high-intent targeting?') into v_exists;
  if not v_exists then
    insert into qa_questions (asked_by_agent_id, question_text, category_tags, visibility, status, is_pinned)
    values (v_admin_id, 'What is the one-sentence positioning for HomeReach high-intent targeting?',
            array['positioning','one-liner','high-intent-pitch'], 'team', 'resolved', true)
    returning id into v_q_id;

    insert into qa_answers (question_id, source, author_agent_id, direct_answer, what_to_say, what_to_do_next, why_this_works, is_official)
    values (v_q_id, 'admin', v_admin_id,
      'We don''t market to everyone. We target the homes most likely to need you right now.',
      jsonb_build_object(
        'dm',    'We don''t market to everyone. We target the homes most likely to need {{service}} right now.',
        'sms',   'We don''t market to everyone. We target the homes most likely to need {{service}} right now.',
        'email', 'We don''t market to everyone. We target the homes most likely to need {{service}} right now.',
        'call',  'We don''t market to everyone. We target the homes most likely to need {{service}} right now.'
      ),
      'Use this as the headline on every outbound email subject line, every landing-page hero, every cold open. Make it the line they remember.',
      'The line does three things: (1) sets HomeReach apart from mass-mail competitors in seven words, (2) centers the prospect''s customer ("who needs you") rather than the prospect, (3) collapses the value prop into something repeatable by a stressed operator who''s never heard of us.',
      true)
    returning id into v_a_id;

    insert into qa_knowledge_entries (source_question_id, source_answer_id, title, body, category_tags)
    values (v_q_id, v_a_id, 'One-Sentence Positioning',
      'The signature line. Repeat everywhere. "We don''t market to everyone. We target the homes most likely to need you right now."',
      array['positioning','one-liner','brand']);
  end if;

  raise notice 'High-intent pitch scripts seeded successfully.';
end $$;
