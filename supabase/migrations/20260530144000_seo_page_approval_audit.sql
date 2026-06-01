-- ============================================================================
-- HomeReach SEO Engine - Approval Audit Fields
-- ============================================================================
-- Adds explicit approval metadata to seo_pages so publishing can require a
-- real admin approval event instead of relying on a bare status change.
-- Additive only.
-- ============================================================================

alter table public.seo_pages
  add column if not exists approved_by uuid null references public.profiles(id) on delete set null;
alter table public.seo_pages
  add column if not exists approved_at timestamptz null;
alter table public.seo_pages
  add column if not exists approval_notes text null;
create index if not exists seo_pages_approved_at_idx on public.seo_pages (approved_at) where approved_at is not null;
comment on column public.seo_pages.approved_by is 'Admin profile that approved this SEO page for publishing.';
comment on column public.seo_pages.approved_at is 'Timestamp when the SEO page was approved for publishing.';
comment on column public.seo_pages.approval_notes is 'Human approval notes and scope for SEO page publishing.';
