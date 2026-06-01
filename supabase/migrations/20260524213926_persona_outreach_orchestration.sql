-- Add sender-persona orchestration to stored outreach sequences.
-- This is draft/approval-safe: the automation renderer resolves persona variables
-- from the active agent identity before any approved send occurs.

do $$
declare
  v_sequence_id uuid;
begin
  select id into v_sequence_id
  from public.auto_sequences
  where name = 'Political Campaign Email Outreach'
  order by created_at asc
  limit 1;

  if v_sequence_id is not null then
    update public.auto_sequence_steps
    set
      subject = case step_number
        when 1 then '{{persona_subject}}'
        when 2 then '{{candidate_name}} campaign mail options - quick follow-up'
        when 3 then 'Should I close out the {{candidate_name}} mail plan?'
        else subject
      end,
      body = case step_number
        when 1 then E'Hi {{contact_name}},\n\n{{persona_opening_line}}\n\n{{persona_value_line}}\n\nWe prepared four mail plan options for {{candidate_name}}:\n\nA. {{option_a_title}}\nB. {{option_b_title}}\nC. {{option_c_title}}\nD. {{option_d_title}}\n\n[[image:{{political_options_image_url}}|Four HomeReach campaign mail plan options for {{candidate_name}}]]\n\nThe four-option view is designed to compare cost per voter, geographic target, total voter reach, timing, and execution risk. Price can stay out of the first email until the campaign asks for the route/pricing summary.\n\nTap here to review the mobile four-option plan:\n{{political_plan_url}}\n\n{{persona_cta}}\n\n{{persona_signoff}}'
        when 2 then E'Hi {{contact_name}},\n\n{{persona_opening_line}}\n\nThe four options are meant to make the decision easier: one foundation plan, one geography-concentrated plan, one balanced plan, and one final-window reminder plan.\n\n[[image:{{political_options_image_url}}|HomeReach political mail options for {{candidate_name}}]]\n\nThe quick comparison is cost per voter, geographic target, total voter reach, timing, and execution risk. Price can be reviewed after the campaign confirms which plan is worth a closer look.\n\nTap here to review the mobile four-option plan:\n{{political_plan_url}}\n\n{{persona_cta}}\n\n{{persona_signoff}}'
        when 3 then E'Hi {{contact_name}},\n\nI do not want to clutter your inbox if mail planning is not a priority right now.\n\nShould I close this out, or would a concise campaign-mail summary for {{candidate_name}} be useful before the next planning meeting?\n\nTap here to review the mobile four-option plan:\n{{political_plan_url}}\n\n{{persona_signoff}}'
        else body
      end
    where sequence_id = v_sequence_id
      and step_number in (1, 2, 3);
  end if;
end;
$$;

do $$
declare
  v_sequence_id uuid;
begin
  select id into v_sequence_id
  from public.auto_sequences
  where name = 'Inventory Procurement Email Outreach'
  order by created_at asc
  limit 1;

  if v_sequence_id is not null then
    update public.auto_sequence_steps
    set
      subject = case step_number
        when 1 then '{{persona_subject}}'
        when 2 then '{{business_name}} supply cost follow-up'
        when 3 then 'Should I close this out for {{business_name}}?'
        else subject
      end,
      body = case step_number
        when 1 then E'Hi {{contact_name}},\n\n{{persona_opening_line}}\n\n{{persona_value_line}}\n\nHomeReach can compare receipts, invoices, inventory sheets, delivery fees, supplier pricing, and recurring reorder patterns. The output is a simple savings rollup: weekly savings found, monthly savings, annualized opportunity, and what is worth approving.\n\nNo spreadsheet rebuilding. No procurement training. Just a clear view of possible savings and the next best action.\n\n{{persona_cta}}\n\n{{procurement_intake_url}}\n\n{{persona_signoff}}'
        when 2 then E'Hi {{contact_name}},\n\n{{persona_opening_line}}\n\nThe costly part of supplies is usually quiet price drift, fuel fees, duplicate buying, delivery friction, substitutions, and invoices that stop matching expected pricing.\n\nHomeReach keeps the owner view simple: savings found, urgent issues, delivery problems, and the exact recommendation worth approving.\n\n{{persona_cta}}\n\n{{procurement_intake_url}}\n\n{{persona_signoff}}'
        when 3 then E'Hi {{contact_name}},\n\nI do not want to keep chasing you if supply savings is not a priority right now.\n\nShould I close this out, or would it be useful for HomeReach to look for hidden overspending in your recurring supplies?\n\nThe simple promise is: send what you already have, and we turn it into a savings view with clear recommendations.\n\n{{procurement_intake_url}}\n\n{{persona_signoff}}'
        else body
      end
    where sequence_id = v_sequence_id
      and step_number in (1, 2, 3);
  end if;
end;
$$;;
