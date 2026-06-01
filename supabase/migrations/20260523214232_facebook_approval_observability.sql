-- Additive Facebook automation approval/observability fields.
-- Keeps existing manual Facebook execution flows intact while allowing webhook
-- generated replies to sit as drafts until a human sends them.

alter table public.facebook_messages
  add column if not exists delivery_status text not null default 'sent',
  add column if not exists approval_status text not null default 'approved',
  add column if not exists requires_approval boolean not null default false,
  add column if not exists proposed_action text,
  add column if not exists source text not null default 'manual',
  add column if not exists approved_at timestamptz,
  add column if not exists sent_by_user_id uuid,
  add column if not exists actual_sent_at timestamptz,
  add column if not exists error_detail text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_facebook_messages_approval_status
  on public.facebook_messages (approval_status, delivery_status, sent_at desc);

create index if not exists idx_facebook_messages_pending_drafts
  on public.facebook_messages (lead_id, sent_at desc)
  where delivery_status = 'draft' and approval_status = 'pending';

create index if not exists idx_facebook_leads_updated_at
  on public.facebook_leads (updated_at desc);

create index if not exists idx_facebook_leads_status
  on public.facebook_leads (lead_status, current_agent, updated_at desc);;
