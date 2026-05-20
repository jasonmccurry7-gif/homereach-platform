-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 069 — Political Quote Engine Helpers
--
-- ADDITIVE rollup layer over migration 068. Adds:
--   • View   political_scenario_route_totals — per-scenario rollup of
--             household / cost / price snapshots from political_route_selections.
--   • View   political_plan_scenario_comparison — side-by-side scenario rows
--             per plan, ready for the Compare UI.
--   • View   political_route_active_holds — currently-held routes (soft+firm)
--             for the Map Coverage layer.
--   • Func   political_recompute_scenario_totals(uuid) — sums route-selection
--             snapshots into political_scenarios output columns. Safe to call
--             after every selection change. Returns the recomputed row.
--   • Func   political_route_is_available(uuid, date, date) — boolean check
--             used by the reservation flow before flipping 'soft'→'firm'.
--   • Trig   political_route_selections_after_change → recomputes the parent
--             scenario totals automatically on insert/update/delete.
--
-- Compliance: read-only aggregations + recompute. No persuasion logic, no
-- voter joins, no PII. Touches only tables created by 068.
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. View — political_scenario_route_totals
--    Per-scenario aggregate of the frozen snapshots stored in
--    political_route_selections. Use this when you want totals derived
--    from the actual selected routes (vs. the cached copy on the scenario row).
-- ═════════════════════════════════════════════════════════════════════════════

create or replace view public.political_scenario_route_totals as
select
  prs.scenario_id,
  count(*)                                                       as route_count,
  coalesce(sum(prs.household_count_snapshot), 0)::integer        as households,
  coalesce(sum(prs.unit_cost_cents_snapshot
              * coalesce(prs.household_count_snapshot, 0)), 0)::bigint
                                                                  as cost_cents,
  coalesce(sum(prs.unit_price_cents_snapshot
              * coalesce(prs.household_count_snapshot, 0)), 0)::bigint
                                                                  as price_cents
from public.political_route_selections prs
group by prs.scenario_id;

comment on view public.political_scenario_route_totals is
  'Per-scenario rollup from political_route_selections frozen snapshots. Multiplies unit cost/price by snapshot household count.';


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. View — political_plan_scenario_comparison
--    Flattened comparison rows: one row per scenario, with plan + campaign
--    context inlined and a "is_selected" flag for the plan's chosen scenario.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace view public.political_plan_scenario_comparison as
select
  pp.id                              as plan_id,
  pp.campaign_id,
  pp.name                            as plan_name,
  pp.budget_cents                    as plan_budget_cents,
  pp.target_window_start,
  pp.target_window_end,
  ps.id                              as scenario_id,
  ps.label                           as scenario_label,
  ps.scenario_type,
  ps.households,
  ps.drops,
  ps.total_pieces,
  ps.total_investment_cents,
  ps.coverage_pct,
  ps.estimated_impressions,
  ps.rationale,
  ps.computed_at,
  (pp.selected_scenario_id = ps.id)  as is_selected,
  -- Budget posture: did we land under, at, or over the plan's ceiling?
  case
    when pp.budget_cents is null then null
    when ps.total_investment_cents is null then null
    when ps.total_investment_cents <= pp.budget_cents then 'within_budget'
    else 'over_budget'
  end                                as budget_posture
from public.political_plans pp
join public.political_scenarios ps on ps.plan_id = pp.id
where pp.archived_at is null;

comment on view public.political_plan_scenario_comparison is
  'Side-by-side scenario rows per plan (active plans only). Powers the Compare UI.';


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. View — political_route_active_holds
--    Routes currently tied up by a soft or firm reservation. Drives the red/
--    yellow tinting on the Map Coverage layer.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace view public.political_route_active_holds as
select
  pr.route_id,
  pr.campaign_id,
  pr.scenario_id,
  pr.drop_window_start,
  pr.drop_window_end,
  pr.drop_index,
  pr.status,
  pr.expires_at,
  pr.reserved_by,
  pr.created_at
from public.political_reservations pr
where pr.status in ('soft', 'firm')
  and (pr.expires_at is null or pr.expires_at > now());

comment on view public.political_route_active_holds is
  'Routes with non-expired soft or firm reservations. Used by the Map Coverage layer to color held routes.';


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Function — political_recompute_scenario_totals(p_scenario_id)
--    Aggregates the route-selection snapshots and writes back to the parent
--    political_scenarios row. Returns the recomputed scenario row so the
--    caller can echo it to the client.
--
--    Does NOT change `inputs` or `quote_snapshot` — only the derived totals.
--    Coverage % is computed against the scenario's stored target households
--    if present in inputs.targetHouseholds (jsonb), else null.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.political_recompute_scenario_totals(p_scenario_id uuid)
returns public.political_scenarios
language plpgsql
as $$
declare
  v_totals  record;
  v_target  integer;
  v_drops   integer;
  v_row     public.political_scenarios;
begin
  -- Fetch existing row first so we have the current `inputs` + `drops`
  select * into v_row
  from public.political_scenarios
  where id = p_scenario_id;

  if not found then
    raise exception 'political_recompute_scenario_totals: scenario % not found', p_scenario_id;
  end if;

  -- Pull the rollup
  select
    coalesce(sum(prs.household_count_snapshot), 0)::integer        as households,
    coalesce(sum(prs.unit_cost_cents_snapshot
                * coalesce(prs.household_count_snapshot, 0)), 0)::bigint
                                                                    as cost_cents,
    coalesce(sum(prs.unit_price_cents_snapshot
                * coalesce(prs.household_count_snapshot, 0)), 0)::bigint
                                                                    as price_cents
  into v_totals
  from public.political_route_selections prs
  where prs.scenario_id = p_scenario_id;

  -- Drops: prefer current row value, then inputs.dropCount, then 1
  v_drops := coalesce(
    v_row.drops,
    nullif((v_row.inputs->>'dropCount'), '')::integer,
    1
  );

  -- Optional target households for coverage %.
  v_target := nullif((v_row.inputs->>'targetHouseholds'), '')::integer;

  update public.political_scenarios
  set
    households             = v_totals.households,
    drops                  = v_drops,
    total_pieces           = v_totals.households * v_drops,
    internal_cost_cents    = v_totals.cost_cents * v_drops,
    total_investment_cents = v_totals.price_cents * v_drops,
    internal_margin_cents  = (v_totals.price_cents - v_totals.cost_cents) * v_drops,
    coverage_pct           = case
      when v_target is null or v_target = 0 then null
      else round((v_totals.households::numeric / v_target::numeric) * 100, 2)
    end,
    -- Industry rule of thumb: each piece sees ~2.3 impressions (pass-around)
    estimated_impressions  = (v_totals.households * v_drops * 2.3)::integer,
    computed_at            = now(),
    updated_at             = now()
  where id = p_scenario_id
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.political_recompute_scenario_totals(uuid) is
  'Recomputes a scenarios output columns (households, drops, pieces, cost, price, coverage %, impressions) from political_route_selections snapshots. Returns the updated row.';


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. Function — political_route_is_available(route_id, window_start, window_end)
--    Returns true iff there's no overlapping soft/firm reservation on this
--    route for the given drop window. Cheap helper for the reservation flow.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.political_route_is_available(
  p_route_id     uuid,
  p_window_start date,
  p_window_end   date
)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1
    from public.political_reservations pr
    where pr.route_id = p_route_id
      and pr.status in ('soft', 'firm')
      and (pr.expires_at is null or pr.expires_at > now())
      -- Standard half-open interval overlap: [a_start, a_end] ∩ [b_start, b_end] ≠ ∅
      and pr.drop_window_start <= p_window_end
      and pr.drop_window_end   >= p_window_start
  );
$$;

comment on function public.political_route_is_available(uuid, date, date) is
  'True if no overlapping soft/firm reservation exists on the route for the given drop window. Use before promoting a soft hold to firm.';


-- ═════════════════════════════════════════════════════════════════════════════
-- 6. Trigger — political_route_selections_after_change
--    Auto-recompute the parent scenario whenever its route selections change.
--    Keeps the cached totals on political_scenarios in sync with the source
--    of truth (the selections rows).
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.tg_political_route_selections_recompute()
returns trigger
language plpgsql
as $$
declare
  v_target uuid;
begin
  if tg_op = 'DELETE' then
    v_target := old.scenario_id;
  else
    v_target := new.scenario_id;
  end if;

  -- Best-effort recompute. Don't fail the original write if the scenario
  -- has been deleted concurrently — the rollup view still works regardless.
  perform public.political_recompute_scenario_totals(v_target);
  return null;  -- AFTER trigger; return value ignored
exception
  when others then
    -- Swallow recompute errors so a transient issue can't block selections.
    -- The view + manual recompute remain available as a recovery path.
    return null;
end;
$$;

drop trigger if exists political_route_selections_after_change
  on public.political_route_selections;

create trigger political_route_selections_after_change
  after insert or update or delete on public.political_route_selections
  for each row execute function public.tg_political_route_selections_recompute();


-- ═════════════════════════════════════════════════════════════════════════════
-- Done — migration 069 complete.
-- ═════════════════════════════════════════════════════════════════════════════
