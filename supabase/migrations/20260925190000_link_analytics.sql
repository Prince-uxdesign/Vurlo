-- Vurlo Phase 6B: analytics engine + metric definitions + aggregation.
--
-- Builds on the Phase 6A `link_events` collection foundation. This migration
-- adds ONLY the calculation layer: ownership-gated aggregate functions. No
-- raw event rows are ever exposed to normal users (see privacy notes below),
-- and no dashboard/UI is built here.
--
-- METRIC DEFINITIONS (the single source of truth; mirrored in
-- lib/analytics/metrics.ts -- keep the two in sync):
--   total_requests  = every recorded redirect event for the link in range.
--   human_clicks    = events with traffic_class = 'human' (a recognizable
--                     interactive browser UA with no automation signal). THIS is
--                     the product's primary "Clicks" number. Unclassifiable
--                     traffic (missing UA) is counted in total_requests and
--                     unknown_traffic but NOT in headline clicks -- claiming it
--                     as human would overstate (same rule as 6A stats).
--   bots            = events with traffic_class = 'bot'.
--   scanners        = events with traffic_class = 'scanner' (previews, AV
--                     sandboxes -- legitimate automation, not attacks).
--   unknown_traffic = events with traffic_class = 'unknown' (missing/
--                     unrecognizable UA -- never assumed malicious).
--   approx_uniques  = count(distinct visitor_hash) over ALL traffic in range,
--                     null hashes excluded. Approximate (see 6A visitor docs).
--   approx_human_uniques = ditto restricted to is_bot = false.
-- Breakdown percentages are shares of HUMAN clicks, computed from real data
-- in the application layer (never stored, never hard-coded).
--
-- TIME RANGES: p_start/p_end are nullable (= unbounded). The app layer maps
-- the MVP presets 24h / 7d / 30d / all onto these bounds
-- (see lib/analytics/presets.ts). Timeseries buckets: 'hour' for short
-- ranges, 'day' for longer ones; bucket counts are capped so a malicious or
-- mistaken caller cannot force a 10,000-row series.
--
-- PERFORMANCE: every query filters on (link_id, occurred_at), served by
-- link_events_link_occurred_idx. Bot-exclusion scans can use the partial
-- link_events_link_human_idx; headline-human predicates (traffic_class =
-- 'human') ride the same composite prefix. Aggregates scan only the link's rows in range
-- and return a compact result -- thousands of events collapse to tens of
-- rows. No pre-aggregation, no Redis/ClickHouse/Kafka: an MVP does not need
-- analytics infrastructure until measured event volume proves otherwise.
-- Retention purges (future) keep the table bounded; see 6A header.
--
-- PRIVACY:
--   - Only aggregates leave the database. There is deliberately NO function
--     returning per-event rows (and no visitor_hash) to normal users.
--   - No cross-dimensional drill-down (e.g. country x hour) is offered: single
--     dimensions stay coarse, and combining dimensions could isolate an
--     individual on low-traffic links.
--   - Hourly buckets exist only for short ranges; per-bucket uniques are NOT
--     offered (distinct-counts per bucket are both expensive and the most
--     identifying slice). Totals carry the uniques.
--   - "Direct" referrer means missing/stripped referrer as often as a typed
--     URL -- the dashboard must label it "Direct / Unknown".
--
-- EMPTY DATA: link functions return a zero row for owners with no events in
-- range (so the UI can render "No clicks yet"), and ZERO rows for non-owners
-- (indistinguishable from not-found -- never another user's data).

-- ---------------------------------------------------------------------------
-- Helper: link ownership gate. Deleted links are excluded: their analytics
-- die with them (events cascade on delete anyway).
-- ---------------------------------------------------------------------------
create or replace function public.owns_link(p_link_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.links l
    where l.id = p_link_id
      and l.user_id = (select auth.uid())
      and l.status <> 'deleted'
  );
$$;

revoke all on function public.owns_link(uuid) from public, anon;
grant execute on function public.owns_link(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- my_link_metrics(): one row of totals for an owned link in an optional
-- window. Owners always get exactly one row (zeros when empty); anyone else
-- gets zero rows.
-- ---------------------------------------------------------------------------
create or replace function public.my_link_metrics(
  p_link_id uuid,
  p_start   timestamptz default null,
  p_end     timestamptz default null
)
returns table (
  total_requests      bigint,
  human_clicks        bigint,
  bots                bigint,
  scanners            bigint,
  unknown_traffic     bigint,
  approx_uniques      bigint,
  approx_human_uniques bigint,
  last_clicked_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.owns_link(p_link_id) then
    return;
  end if;

  return query
  select
    count(*),
    count(*) filter (where e.traffic_class = 'human'),
    count(*) filter (where e.traffic_class = 'bot'),
    count(*) filter (where e.traffic_class = 'scanner'),
    count(*) filter (where e.traffic_class = 'unknown'),
    count(distinct e.visitor_hash) filter (where e.visitor_hash is not null),
    count(distinct e.visitor_hash) filter (where e.visitor_hash is not null and e.traffic_class = 'human'),
    max(e.occurred_at)
  from public.link_events e
  where e.link_id = p_link_id
    and (p_start is null or e.occurred_at >= p_start)
    and (p_end is null or e.occurred_at < p_end);
end;
$$;

revoke all on function public.my_link_metrics(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.my_link_metrics(uuid, timestamptz, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- my_link_timeseries(): gap-filled buckets for clicks over time.
-- p_bucket is 'hour' or 'day' (anything else folds to 'day'). Bucket counts
-- are capped (8760 hours / 370 days) so an unbounded caller cannot force a
-- gigantic series; the app layer picks hour for 24h and day otherwise.
-- ---------------------------------------------------------------------------
create or replace function public.my_link_timeseries(
  p_link_id uuid,
  p_start   timestamptz,
  p_end     timestamptz,
  p_bucket  text default 'day'
)
returns table (
  bucket_start timestamptz,
  total        bigint,
  human        bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bucket text := case when p_bucket = 'hour' then 'hour' else 'day' end;
  v_step   interval := case when p_bucket = 'hour' then interval '1 hour' else interval '1 day' end;
  v_cap    integer := case when p_bucket = 'hour' then 8760 else 370 end;
begin
  if not public.owns_link(p_link_id) then
    return;
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    return;
  end if;

  return query
  with bounds as (
    select date_trunc(v_bucket, p_start) as first_bucket
  ),
  series as (
    select generate_series(
      (select first_bucket from bounds),
      date_trunc(v_bucket, p_end - interval '1 microsecond'),
      v_step
    ) as bucket_start
  ),
  capped as (
    select s.bucket_start,
           row_number() over (order by s.bucket_start) as rn
    from series s
  )
  -- NOTE: the edge buckets are partial (p_start/p_end rarely align to the
  -- hour/day), so the join re-applies the half-open range: a bucket only
  -- counts events with p_start <= occurred_at < p_end. Bucket sums therefore
  -- always reconcile exactly with my_link_metrics for the same window, at the
  -- cost of one extra partial bucket when unaligned (25 hourly points for a
  -- live "24h" view). The app layer may pass pre-aligned bounds when it wants
  -- exactly 24/7/30 points.
  select
    c.bucket_start,
    count(e.id) as total,
    count(e.id) filter (where e.traffic_class = 'human') as human
  from capped c
  left join public.link_events e
    on e.link_id = p_link_id
   and date_trunc(v_bucket, e.occurred_at) = c.bucket_start
   and e.occurred_at >= p_start
   and e.occurred_at < p_end
  where c.rn <= v_cap
  group by c.bucket_start
  order by c.bucket_start;
end;
$$;

revoke all on function public.my_link_timeseries(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.my_link_timeseries(uuid, timestamptz, timestamptz, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- my_link_breakdown(): single-dimension aggregation.
-- p_dimension allow-list: 'device' | 'browser' | 'os' | 'country' |
-- 'referrer'. Anything else returns zero rows (never an error the caller can
-- probe, never dynamic SQL). Ordered by human desc so rare browsers collapse
-- naturally to the bottom; the app layer groups the tail into "Other" only
-- for display if needed -- stored values are already coarse.
-- ---------------------------------------------------------------------------
create or replace function public.my_link_breakdown(
  p_link_id   uuid,
  p_dimension text,
  p_start     timestamptz default null,
  p_end       timestamptz default null
)
returns table (
  key   text,
  total bigint,
  human bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.owns_link(p_link_id) then
    return;
  end if;
  if p_dimension not in ('device', 'browser', 'os', 'country', 'referrer') then
    return;
  end if;

  return query
  select
    case p_dimension
      when 'device'   then e.device_type
      when 'browser'  then e.browser
      when 'os'       then e.operating_system
      when 'country'  then e.country_code
      when 'referrer' then e.referrer_source
    end as key,
    count(*) as total,
    count(*) filter (where e.traffic_class = 'human') as human
  from public.link_events e
  where e.link_id = p_link_id
    and (p_start is null or e.occurred_at >= p_start)
    and (p_end is null or e.occurred_at < p_end)
  group by 1
  order by 3 desc, 1 asc;
end;
$$;

revoke all on function public.my_link_breakdown(uuid, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.my_link_breakdown(uuid, text, timestamptz, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- my_account_metrics(): account-level foundation for User -> Links -> Events.
-- One row for any signed-in user (zeros when nothing); anon cannot execute.
-- approx_uniques is distinct across the whole account in range. deleted links
-- are excluded from both the link count and their events.
-- ---------------------------------------------------------------------------
create or replace function public.my_account_metrics(
  p_start timestamptz default null,
  p_end   timestamptz default null
)
returns table (
  total_requests       bigint,
  human_clicks         bigint,
  bots                 bigint,
  scanners             bigint,
  approx_uniques       bigint,
  links_clicked        bigint,
  total_links          bigint,
  last_clicked_at      timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select l.id
    from public.links l
    where l.user_id = (select auth.uid())
      and l.status <> 'deleted'
  ),
  ranged as (
    select e.link_id, e.is_bot, e.traffic_class, e.visitor_hash, e.occurred_at
    from public.link_events e
    join mine m on m.id = e.link_id
    where (p_start is null or e.occurred_at >= p_start)
      and (p_end is null or e.occurred_at < p_end)
  )
  select
    (select count(*) from ranged),
    (select count(*) from ranged where traffic_class = 'human'),
    (select count(*) from ranged where traffic_class = 'bot'),
    (select count(*) from ranged where traffic_class = 'scanner'),
    (select count(distinct visitor_hash) from ranged where visitor_hash is not null),
    (select count(distinct link_id) from ranged),
    (select count(*) from mine),
    (select max(occurred_at) from ranged);
$$;

revoke all on function public.my_account_metrics(timestamptz, timestamptz) from public, anon;
grant execute on function public.my_account_metrics(timestamptz, timestamptz) to authenticated, service_role;
