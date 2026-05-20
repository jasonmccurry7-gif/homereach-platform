-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 061 — Political Command Center: Proposals + Orders
--
-- Adds two new tables to the political module:
--   1. political_proposals — customer-facing proposal with an embedded quote
--      snapshot (from generatePoliticalQuote), a public token for
--      no-auth viewing at /p/[token], and a status lifecycle
--      (draft → sent → viewed → approved | declined).
--   2. political_orders — payment/fulfillment shell created when a proposal
--      is approved. Tracks Stripe checkout sessions, payment status,
--      and fulfillment status. NEVER reuses the existing `orders` table.
--
-- Design notes:
--   • Quote snapshot is stored on political_proposals as jsonb + denormalized
--     key fields (total_cents, total_pieces, households, drops) for fast
--     dashboard queries without deserializing jsonb. Single table replaces
--     a separate political_quotes table for simplicity during Phase 3–4
--     validation; can split later if quote history becomes important.
--   • Public token is a 32-byte hex string generated app-side; uniqueness
--     enforced by a partial unique index (NULL safe).
--   • Status enums are explicit for safety — free-text lifecycles in Phase 1
--     taught us that "new"-vs-"active"-vs-"prospect" drift gets messy.
--   • RLS follows the 059/060 pattern: admin full, sales_agent scoped,
--     service_role full, client=none. Client portal access via the public
--     token is enforced at the application layer using the service-role
--     client (token-gated reads; no Supabase row-level auth needed).
--   • Money lives in cents (bigint). Consistent with 060 and the rest of
--     HomeReach's revenue code.
--
-- Compliance:
--   • No voter data, no persuasion scores, no ideology columns.
--   • pricing_snapshot (jsonb) is the internal truth — contains cost, margin,
--     profit. Never rendered on the public /p/[token] page; only the
--     operational clientSummary is.
--
-- SAFE TO RE-RUN. All additive. All idempotent.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Enums
-- ═════════════════════════════════════════════════════════════════════════════

do $$ begin
  create type public.political_proposal_status_enum as enum (
    'draft',
    'sent',
    'viewed',
    'approved',
    'declined',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.political_order_payment_status_enum as enum (
    'pending',
    'deposit_paid',
    'paid',
    'failed',
    'refunded',
    'canceled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.political_order_fulfillment_status_enum as enum (
    'pending',
    'production',
    'mailed',
    'delivered',
    'completed',
    'canceled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.political_order_payment_mode_enum as enum (
    'deposit',
    'full'
  );
exception
  when duplicate_object then null;
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. political_proposals
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_proposals (
  id                         uuid primary key default gen_random_uuid(),

  -- Parentage — a proposal belongs to a specific campaign engagement which
  -- belongs to a specific candidate. Both denormalized for dashboard queries.
  campaign_id                uuid not null references public.political_campaigns(id) on delete cascade,
  candidate_id               uuid not null references public.campaign_candidates(id) on delete cascade,

  -- Lifecycle
  status                     public.political_proposal_status_enum not null default 'draft',
  sent_at                    timestamptz,
  viewed_at                  timestamptz,
  approved_at                timestamptz,
  declined_at                timestamptz,
  expires_at                 timestamptz,

  -- Public token — 32-byte hex from app code.
  public_token               text,

  -- Who created this proposal (admin or sales_agent).
  created_by                 uuid references public.profiles(id) on delete set null,

  -- Snapshot of the generated quote (from generatePoliticalQuote).
  -- Full shape in jsonb; hot fields denormalized for fast admin queries.
  pricing_snapshot           jsonb not null default '{}'::jsonb,
  households                 bigint not null default 0,
  drops                      integer not null default 0,
  total_pieces               bigint not null default 0,
  total_investment_cents     bigint not null default 0,
  -- Internal margin / cost copied from the snapshot. NEVER rendered client-side.
  internal_cost_cents        bigint not null default 0,
  internal_margin_cents      bigint not null default 0,

  -- For convenience — the client-safe summary text, pre-rendered.
  delivery_window_text       text,

  -- Counters
  resend_count               integer not null default 0,
  last_resent_at             timestamptz,

  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

-- Partial unique on public_token (NULL-safe): drafts have no token, and only
-- assigned tokens need uniqueness.
create unique index if not exists political_proposals_public_token_idx
  on public.political_proposals (public_token)
  where public_token is not null;

create index if not exists political_proposals_campaign_idx   on public.political_proposals (campaign_id);
create index if not exists political_proposals_candidate_idx  on public.political_proposals (candidate_id);
create index if not exists political_proposals_status_idx     on public.political_proposals (status);
create index if not exists political_proposals_created_by_idx on public.political_proposals (created_by);
create index if not exists political_proposals_sent_at_idx    on public.political_proposals (sent_at desc)
  where sent_at is not null;
create index if not exists political_proposals_expires_at_idx on public.political_proposals (expires_at)
  where expires_at is not null;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. political_orders
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_orders (
  id                         uuid primary key default gen_random_uuid(),

  proposal_id                uuid not null references public.political_proposals(id) on delete restrict,
  campaign_id                uuid not null references public.political_campaigns(id) on delete cascade,

  -- Financial
  -- total_cents is always what we expect to receive across deposit + balance.
  -- amount_paid_cents accumulates as payments complete.
  total_cents                bigint  not null,
  amount_paid_cents          bigint  not null default 0,
  payment_mode               public.political_order_payment_mode_enum,
  payment_status             public.political_order_payment_status_enum not null default 'pending',

  -- Stripe references. Unique constraints on payment_intent_id guard against
  -- double-inserts when processing returns / webhook retries (even though
  -- Phase 4 doesn't wire a webhook; future-proofing).
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  stripe_customer_id         text,

  -- Fulfillment
  fulfillment_status         public.political_order_fulfillment_status_enum not null default 'pending',

  -- Timestamps for lifecycle
  approved_at                timestamptz,
  paid_at                    timestamptz,
  fulfillment_started_at     timestamptz,
  completed_at               timestamptz,
  canceled_at                timestamptz,

  -- Free-text notes for ops
  notes                      text,

  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint political_orders_total_cents_nonneg check (total_cents >= 0),
  constraint political_orders_amount_paid_nonneg check (amount_paid_cents >= 0)
);

create unique index if not exists political_orders_payment_intent_idx
  on public.political_orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists political_orders_checkout_session_idx
  on public.political_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists political_orders_proposal_idx  on public.political_orders (proposal_id);
create index if not exists political_orders_campaign_idx  on public.political_orders (campaign_id);
create index if not exists political_orders_payment_idx   on public.political_orders (payment_status);
create index if not exists political_orders_fulfillment_idx on public.political_orders (fulfillment_status);


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Row Level Security
--    Mirrors 059/060: service_role full, admin full, sales_agent scoped,
--    client gets none (public-token reads happen via service-role client).
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.political_proposals enable row level security;
alter table public.political_orders    enable row level security;

-- ── political_proposals ─────────────────────────────────────────────────────

drop policy if exists "political_proposals_service" on public.political_proposals;
create policy "political_proposals_service"
  on public.political_proposals for all to service_role using (true) with check (true);

drop policy if exists "political_proposals_admin" on public.political_proposals;
create policy "political_proposals_admin"
  on public.political_proposals for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "political_proposals_agent_read" on public.political_proposals;
create policy "political_proposals_agent_read"
  on public.political_proposals for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','sales_agent')));

drop policy if exists "political_proposals_agent_insert" on public.political_proposals;
create policy "political_proposals_agent_insert"
  on public.political_proposals for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'sales_agent')
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists "political_proposals_agent_update_own" on public.political_proposals;
create policy "political_proposals_agent_update_own"
  on public.political_proposals for update to authenticated
  using      (created_by = auth.uid())
  with check (created_by = auth.uid());

-- ── political_orders ────────────────────────────────────────────────────────

drop policy if exists "political_orders_service" on public.political_orders;
create policy "political_orders_service"
  on public.political_orders for all to service_role using (true) with check (true);

drop policy if exists "political_orders_admin" on public.political_orders;
create policy "political_orders_admin"
  on public.political_orders for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "political_orders_agent_read" on public.political_orders;
create policy "political_orders_agent_read"
  on public.political_orders for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','sales_agent')));

-- Sales agents may not directly insert/update orders from a user session —
-- all order writes go through the service-role path (from approve / payment
-- completion server actions). This prevents a sales_agent from, e.g.,
-- manually marking an order paid without a real Stripe session.
--
-- (No insert/update policies for authenticated non-admin. Service role only.)


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. updated_at triggers (reuse the 059 function)
-- ═════════════════════════════════════════════════════════════════════════════

drop trigger if exists trg_political_proposals_updated_at on public.political_proposals;
create trigger trg_political_proposals_updated_at
  before update on public.political_proposals
  for each row execute function public.tg_political_touch_updated_at();

drop trigger if exists trg_political_orders_updated_at on public.political_orders;
create trigger trg_political_orders_updated_at
  before update on public.political_orders
  for each row execute function public.tg_political_touch_updated_at();
