-- Phase 5A: UTM values are plain text, validated in the app (lib/validation/utm.ts).
-- The database keeps the invariants that matter even if a write bypasses the
-- app: no surrounding whitespace and no control characters. Existing rows
-- were written through stricter rules, so they already satisfy these checks.

alter table public.links
  add constraint links_utm_source_clean
    check (utm_source is null or (utm_source = btrim(utm_source) and utm_source !~ '[[:cntrl:]]')),
  add constraint links_utm_medium_clean
    check (utm_medium is null or (utm_medium = btrim(utm_medium) and utm_medium !~ '[[:cntrl:]]')),
  add constraint links_utm_campaign_clean
    check (utm_campaign is null or (utm_campaign = btrim(utm_campaign) and utm_campaign !~ '[[:cntrl:]]'));
-- Vurlo Phase 6A: analytics data-collection foundation (click events only).
--
-- Principle: honest, lean, privacy-preserving analytics. We record what the
-- redirect legitimately observes; we never claim perfect identity, never
-- fabricate country/referrer, and never retain raw IPs or full user agents.
--
-- Privacy model (also documented in lib/analytics/privacy.ts):
--   - No raw IP is stored anywhere. Visitor uniqueness uses a salted,
--     day-bucketed SHA-256 hash (see lib/analytics/visitor.ts) so hashes
--     rotate daily and cannot be joined across days into a permanent profile.
--   - No full user-agent or full referrer URL is stored. Only coarse,
--     enumerated classifications (device/browser/os/traffic class/referrer
--     source) are persisted.
--   - Country comes only from trustworthy infrastructure metadata
--     (e.g. Vercel `x-vercel-ip-country`, Cloudflare `cf-ipcountry`).
--     When absent or malformed we store 'unknown' -- never a guess.
--
-- Performance model:
--   - The redirect hot path (`resolve_link`) is unchanged: 1 read-only RPC,
--     no writes before responding.
--   - Event inserts happen OFF the critical path via `after()` in
--     app/[slug]/page.tsx, calling `record_link_event()` (a single RPC).
--     A slow or failed analytics write can never delay or break a redirect.
--
-- Retention (future work, NOT enforced yet):
--   - `occurred_at` is indexed so a later policy can
--     `delete from public.link_events where occurred_at < now() - <window>`.
--   - Do not promise users a retention window until that delete is scheduled.
--     Phase 7+ should add the scheduled purge + surface the policy in-product.
--
-- What this migration does NOT build: dashboards, charts, maps, exports,
-- scheduled reports, AI analytics, recommendations, campaign analytics.

-- ---------------------------------------------------------------------------
-- Click events. One row per observed redirect (active links only -- the
-- record function refuses to log expired/disabled/archived/deleted/unknown
-- slugs). Expected to grow substantially beyond `links`, hence lean columns
-- and a minimal index set.
-- ---------------------------------------------------------------------------
create table public.link_events (
  id              uuid primary key default gen_random_uuid(),
  link_id         uuid not null references public.links (id) on delete cascade,
  occurred_at     timestamptz not null default now(),
  -- Salted day-bucketed visitor signal (64 lowercase hex) or null when the
  -- request carried nothing usable (no IP and no UA). Approximate only: VPNs,
  -- shared devices, privacy browsers and bot farms all blur it. Never treat
  -- count(distinct visitor_hash) as "exactly N people".
  visitor_hash    text,
  device_type     text not null default 'unknown',
  browser         text not null default 'unknown',
  operating_system text not null default 'unknown',
  -- Uppercase ISO-3166 alpha-2 (e.g. 'US') or 'unknown'. Approximate: VPNs,
  -- relays and missing infra headers make this coarse by design.
  country_code    text not null default 'unknown',
  -- Coarse acquisition source ('direct', 'google', 'instagram', ...). The raw
  -- Referer URL is never stored (it can contain query-string PII and is often
  -- stripped by browsers anyway). Missing referrer => 'direct'.
  referrer_source text not null default 'direct',
  -- 'human' | 'bot' | 'scanner' | 'unknown'. Scanners are previews/security
  -- fetchers (link unfurlers, AV sandboxes) -- not malicious, just automated.
  traffic_class   text not null default 'unknown',
  is_bot          boolean not null default false,

  constraint link_events_visitor_hash_format
    check (visitor_hash is null or visitor_hash ~ '^[0-9a-f]{64}$'),
  constraint link_events_device_check
    check (device_type in ('desktop', 'mobile', 'tablet', 'unknown')),
  constraint link_events_browser_check
    check (browser in ('chrome', 'safari', 'firefox', 'edge', 'other', 'unknown')),
  constraint link_events_os_check
    check (operating_system in ('windows', 'macos', 'ios', 'android', 'linux', 'other', 'unknown')),
  constraint link_events_country_check
    check (country_code = 'unknown' or country_code ~ '^[A-Z]{2}$'),
  constraint link_events_referrer_check
    check (char_length(referrer_source) between 1 and 32
           and referrer_source ~ '^[a-z0-9_]+$'),
  constraint link_events_traffic_check
    check (traffic_class in ('human', 'bot', 'scanner', 'unknown'))
);

comment on table public.link_events is
  'Phase 6A: one row per observed redirect of an active link. Coarse classifications only; no raw IPs, user agents, or referrer URLs. Approx uniques via day-bucketed visitor_hash.';
comment on column public.link_events.visitor_hash is
  'Salted SHA-256(ip|ua|day) hex, rotates daily. Approximate unique-visitor signal only -- see lib/analytics/visitor.ts.';

-- Main read path (future dashboard): one link's events, newest first.
create index link_events_link_occurred_idx
  on public.link_events (link_id, occurred_at desc);

-- Retention purges and time-range scans. Supports:
--   delete from public.link_events where occurred_at < now() - interval 'x';
create index link_events_occurred_idx
  on public.link_events (occurred_at desc);

-- Human-only counts ("likely humans") without scanning bot rows. Justified:
-- dashboards will query human traffic far more than bot traffic.
create index link_events_link_human_idx
  on public.link_events (link_id, occurred_at desc)
  where is_bot = false;

-- ---------------------------------------------------------------------------
-- Privileges + RLS: deny by default. Nobody reads/writes rows directly.
-- Writes go through record_link_event(); reads go through
-- my_link_event_stats(). The server (service role) retains full access for
-- future maintenance/purges.
-- ---------------------------------------------------------------------------
revoke all on table public.link_events from public, anon, authenticated;
grant all on table public.link_events to service_role;
alter table public.link_events enable row level security;

-- No policies: direct table access is denied for anon/authenticated even
-- though RLS is enabled (fail-closed). All access is via the functions below.

-- ---------------------------------------------------------------------------
-- record_link_event(): the ONLY write path for anonymous redirect traffic.
--
-- SECURITY DEFINER so anonymous visitors (who have no table access) can log
-- the click they just caused. It re-resolves the slug itself and only logs
-- when the link is effectively 'active', so arbitrary clients cannot submit
-- events for another link_id and cannot fabricate events for expired /
-- disabled / deleted / unknown slugs. Enum inputs are coerced to their
-- allow-lists (unknown/direct fallback) so a malformed caller can't violate
-- the CHECKs or poison analytics.
-- ---------------------------------------------------------------------------
create or replace function public.record_link_event(
  p_slug            text,
  p_device_type     text default 'unknown',
  p_browser         text default 'unknown',
  p_operating_system text default 'unknown',
  p_country_code    text default 'unknown',
  p_referrer_source text default 'direct',
  p_traffic_class   text default 'unknown',
  p_is_bot          boolean default false,
  p_visitor_hash    text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link_id uuid;
  v_status  text;
  v_event   uuid;
begin
  if p_slug is null or p_slug = '' then
    return null;
  end if;

  select l.id, public.effective_link_status(l.status, l.expires_at)
    into v_link_id, v_status
  from public.links l
  where l.slug = lower(p_slug)
  limit 1;

  -- Unknown slug, or not currently redirectable: log nothing, break nothing.
  if v_link_id is null or v_status <> 'active' then
    return null;
  end if;

  insert into public.link_events (
    link_id, visitor_hash, device_type, browser, operating_system,
    country_code, referrer_source, traffic_class, is_bot
  ) values (
    v_link_id,
    case when p_visitor_hash ~ '^[0-9a-f]{64}$' then p_visitor_hash else null end,
    case when p_device_type in ('desktop', 'mobile', 'tablet', 'unknown') then p_device_type else 'unknown' end,
    case when p_browser in ('chrome', 'safari', 'firefox', 'edge', 'other', 'unknown') then p_browser else 'unknown' end,
    case when p_operating_system in ('windows', 'macos', 'ios', 'android', 'linux', 'other', 'unknown') then p_operating_system else 'other' end,
    case when p_country_code = 'unknown' or p_country_code ~ '^[A-Z]{2}$' then p_country_code else 'unknown' end,
    case when p_referrer_source ~ '^[a-z0-9_]{1,32}$' then p_referrer_source else 'other' end,
    case when p_traffic_class in ('human', 'bot', 'scanner', 'unknown') then p_traffic_class else 'unknown' end,
    coalesce(p_is_bot, false)
  ) returning id into v_event;

  return v_event;
end;
$$;

revoke all on function public.record_link_event(text, text, text, text, text, text, text, boolean, text) from public;
grant execute on function public.record_link_event(text, text, text, text, text, text, text, boolean, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- my_link_event_stats(): ownership-checked aggregates for ONE link.
--
-- SECURITY DEFINER (runs as the function owner, which has table access) with
-- an explicit `l.user_id = auth.uid()` predicate, so direct table access can
-- stay revoked for anon/authenticated while owners still get their own
-- aggregates. Requesting another user's link_id returns zero rows -- never
-- their data. Anonymous callers get zero rows (auth.uid() is null, matches
-- nothing).
-- No per-event rows are exposed here -- only counts -- so a future dashboard
-- cannot leak individual visitor_hash values by default.
--
-- approx_uniques counts distinct day-bucketed visitor_hash values and is
-- explicitly approximate (see visitor docs). Null hashes are excluded.
-- ---------------------------------------------------------------------------
-- Ownership gate: non-owners (and anonymous callers) get ZERO rows, not a
-- row of zeros, so callers can treat "no row" as not-found/forbidden without
-- learning anything about the link. (A bare aggregate would always return one
-- row, even for a link you don't own -- hence plpgsql, not plain SQL.)
create or replace function public.my_link_event_stats(p_link_id uuid)
returns table (
  total           bigint,
  human           bigint,
  bots            bigint,
  scanners        bigint,
  approx_uniques  bigint,
  last_clicked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.links l
    where l.id = p_link_id
      and l.user_id = (select auth.uid())
      and l.status <> 'deleted'
  ) then
    return;
  end if;

  return query
  select
    count(*),
    count(*) filter (where e.traffic_class = 'human'),
    count(*) filter (where e.traffic_class = 'bot'),
    count(*) filter (where e.traffic_class = 'scanner'),
    count(distinct e.visitor_hash) filter (where e.visitor_hash is not null),
    max(e.occurred_at)
  from public.link_events e
  where e.link_id = p_link_id;
end;
$$;

revoke all on function public.my_link_event_stats(uuid) from public, anon;
grant execute on function public.my_link_event_stats(uuid) to authenticated;
-- service_role gets it via default privileges; ensure explicitly for clarity.
grant execute on function public.my_link_event_stats(uuid) to service_role;
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
-- Vurlo Phase 7: dashboard aggregates.
--
-- Four small, ownership-gated read functions that let the dashboard and the
-- link list show real click data without loading events:
--
--   my_links_clicks(ids)         all-time human clicks + last human click for
--                                up to 100 of the caller's links (one query
--                                for a whole page of rows).
--   my_account_timeseries(s, e)  gap-filled daily clicks across all of the
--                                caller's links (the dashboard trend).
--   my_top_links(s, e, n)        the caller's most-clicked links in a window.
--   my_recent_activity(n)        a short, derived activity feed: the latest
--                                lifecycle change per link (created, updated,
--                                disabled, archived, expired) plus one "clicked"
--                                summary per link with human clicks in the last
--                                24 hours. It is derived from what is stored,
--                                not an event log, and never claims to be.
--
-- Same rules as 20260925190000_link_analytics.sql: SECURITY DEFINER with an
-- explicit `user_id = auth.uid()` predicate (direct link_events access stays
-- revoked), deleted links excluded, only aggregates leave the database, the
-- headline click is traffic_class = 'human', and every result is bounded.

-- ---------------------------------------------------------------------------
-- my_links_clicks(): per-link totals for a page of rows. Ids that aren't the
-- caller's (or are deleted) simply don't come back. At most 100 ids are read.
-- ---------------------------------------------------------------------------
create or replace function public.my_links_clicks(p_link_ids uuid[])
returns table (
  link_id         uuid,
  human_clicks    bigint,
  last_clicked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id,
    count(e.id) filter (where e.traffic_class = 'human'),
    max(e.occurred_at) filter (where e.traffic_class = 'human')
  from public.links l
  left join public.link_events e on e.link_id = l.id
  where l.id = any (p_link_ids[1:100])
    and l.user_id = (select auth.uid())
    and l.status <> 'deleted'
  group by l.id;
$$;

revoke all on function public.my_links_clicks(uuid[]) from public, anon;
grant execute on function public.my_links_clicks(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- my_account_timeseries(): daily buckets across the caller's links. Returns
-- nothing for anonymous callers or a bad/oversized window (max 370 days), so
-- a caller cannot force a huge series.
-- ---------------------------------------------------------------------------
create or replace function public.my_account_timeseries(
  p_start timestamptz,
  p_end   timestamptz
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
begin
  if (select auth.uid()) is null then
    return;
  end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end - p_start > interval '370 days' then
    return;
  end if;

  -- Buckets are UTC days whatever the session time zone (the UI labels them
  -- in UTC). Stepping over dates, not timestamptz, keeps DST from shifting
  -- a bucket boundary.
  return query
  with series as (
    select (d at time zone 'UTC') as bucket_start
    from generate_series(
      (p_start at time zone 'UTC')::date::timestamp,
      ((p_end - interval '1 microsecond') at time zone 'UTC')::date::timestamp,
      interval '1 day'
    ) as d
  ),
  counts as (
    select
      date_trunc('day', e.occurred_at, 'UTC') as bucket_start,
      count(*) as total,
      count(*) filter (where e.traffic_class = 'human') as human
    from public.link_events e
    join public.links l on l.id = e.link_id
    where l.user_id = (select auth.uid())
      and l.status <> 'deleted'
      and e.occurred_at >= p_start
      and e.occurred_at < p_end
    group by 1
  )
  select s.bucket_start, coalesce(c.total, 0)::bigint, coalesce(c.human, 0)::bigint
  from series s
  left join counts c on c.bucket_start = s.bucket_start
  order by s.bucket_start;
end;
$$;

revoke all on function public.my_account_timeseries(timestamptz, timestamptz) from public, anon;
grant execute on function public.my_account_timeseries(timestamptz, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- my_top_links(): most human clicks in a window. Links with no human clicks
-- in the window are left out (a "top" list of zeros says nothing). Limit is
-- clamped to 1..10.
-- ---------------------------------------------------------------------------
create or replace function public.my_top_links(
  p_start timestamptz default null,
  p_end   timestamptz default null,
  p_limit integer default 3
)
returns table (
  link_id      uuid,
  slug         text,
  human_clicks bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.slug, count(*) as human_clicks
  from public.links l
  join public.link_events e on e.link_id = l.id
  where l.user_id = (select auth.uid())
    and l.status <> 'deleted'
    and e.traffic_class = 'human'
    and (p_start is null or e.occurred_at >= p_start)
    and (p_end is null or e.occurred_at < p_end)
  group by l.id, l.slug
  order by 3 desc, l.slug asc
  limit least(greatest(coalesce(p_limit, 3), 1), 10);
$$;

revoke all on function public.my_top_links(timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.my_top_links(timestamptz, timestamptz, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- my_recent_activity(): newest first, clamped to 1..20 rows.
--   kind      'created' | 'updated' | 'disabled' | 'archived' | 'expired' | 'clicked'
--   clicks    human clicks in the last 24 hours ('clicked' rows only, else 0)
-- Lifecycle rows describe each link's CURRENT state at the time it last
-- changed (disabled/archived come from updated_at, which the links trigger
-- bumps on every change), so an old status never reappears as news.
-- ---------------------------------------------------------------------------
create or replace function public.my_recent_activity(p_limit integer default 6)
returns table (
  kind        text,
  link_id     uuid,
  slug        text,
  occurred_at timestamptz,
  clicks      bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select l.id, l.slug, l.status, l.expires_at, l.created_at, l.updated_at
    from public.links l
    where l.user_id = (select auth.uid())
      and l.status <> 'deleted'
  ),
  lifecycle as (
    select
      case
        when m.status = 'active' and m.expires_at is not null and m.expires_at <= now() then 'expired'
        when m.status in ('disabled', 'archived') then m.status
        when m.updated_at - m.created_at > interval '5 seconds' then 'updated'
        else 'created'
      end as kind,
      m.id as link_id,
      m.slug,
      case
        when m.status = 'active' and m.expires_at is not null and m.expires_at <= now() then m.expires_at
        when m.status in ('disabled', 'archived') then m.updated_at
        when m.updated_at - m.created_at > interval '5 seconds' then m.updated_at
        else m.created_at
      end as occurred_at,
      0::bigint as clicks
    from mine m
  ),
  clicked as (
    select 'clicked'::text, m.id, m.slug, max(e.occurred_at), count(*)
    from mine m
    join public.link_events e on e.link_id = m.id
    where e.occurred_at >= now() - interval '24 hours'
      and e.traffic_class = 'human'
    group by m.id, m.slug
  ),
  combined as (
    select * from lifecycle
    union all
    select * from clicked
  )
  select c.kind, c.link_id, c.slug, c.occurred_at, c.clicks
  from combined c
  order by c.occurred_at desc, c.kind asc
  limit least(greatest(coalesce(p_limit, 6), 1), 20);
$$;

revoke all on function public.my_recent_activity(integer) from public, anon;
grant execute on function public.my_recent_activity(integer) to authenticated, service_role;
-- Vurlo Phase 8A: security hardening.
--
-- 1. Analytics writes become server-only.
--    record_link_event() was executable by `anon` and `authenticated`. The
--    anon key is public by design, so anyone could call
--    POST /rest/v1/rpc/record_link_event directly and insert unlimited
--    "human" clicks (with chosen country/device/visitor hash) for any active
--    slug: forged analytics for every user, and an unbounded table. The
--    redirect handler now records through the service-role client, so the
--    function only needs to be executable by service_role.
--
-- 2. No more implicit EXECUTE on new functions.
--    Supabase's default privileges grant EXECUTE on every new public function
--    to anon and authenticated, so `revoke ... from public` alone never
--    removed access (that is how #1 happened). From here on, functions
--    created by this role are callable only where a migration grants it.
--    Existing functions keep their explicit grants; see the RLS review in
--    supabase/README.md for the full list.
--
-- 3. Trigger functions are revoked from API roles for tidiness (they can't
--    be called directly anyway, but nothing should advertise them).
--
-- 4. More reserved slugs: real app routes that were missing (forgot-password,
--    reset-password) and words that read as official account or security
--    pages (verify, confirm, password, ...), which make convincing phishing
--    links on our domain. Kept in sync with lib/links/reserved-slugs.ts
--    (tests/links-db.test.ts compares the two).
--    Note: CHECK constraints are re-evaluated on every UPDATE of a row, so a
--    pre-existing link whose slug is newly reserved could no longer be
--    edited. Vurlo is pre-launch; the check below fails the migration loudly
--    if such a row exists rather than silently stranding it.

-- 1 -------------------------------------------------------------------------
revoke all on function public.record_link_event(text, text, text, text, text, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.record_link_event(text, text, text, text, text, text, text, boolean, text)
  to service_role;

-- 2 -------------------------------------------------------------------------
-- EXECUTE for PUBLIC is a global default, and per-schema defaults can only
-- add to globals, never remove them, so PUBLIC is revoked globally. The
-- anon/authenticated grants are Supabase's per-schema defaults and are
-- revoked per schema. Functions (and triggers) still run for their owner,
-- and SECURITY DEFINER bodies run as the owner, so nothing internal breaks.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- 3 -------------------------------------------------------------------------
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- 4 -------------------------------------------------------------------------
create or replace function public.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(p_slug) = any (array[
    -- Application routes (current and planned)
    'api', 'auth', 'app', 'dashboard', 'links', 'link', 'settings', 'account',
    'profile', 'login', 'logout', 'signin', 'signup', 'register', 'admin',
    'showcase', 'new', 'create', 'edit', 'preview', 'qr', 'analytics',
    'forgot-password', 'reset-password', 'callback', 'confirm', 'error',
    'billing', 'team', 'teams', 'user', 'users', 'home', 'index',
    -- Account and security words (convincing phishing on our own domain)
    'password', 'reset', 'verify', 'verification', 'oauth', 'sso', 'session',
    'sign-in', 'sign-up', 'log-in', 'log-out', 'sign-out', 'signout',
    'official', 'trust', 'safety', 'report-abuse',
    -- Marketing / informational pages
    'about', 'help', 'support', 'contact', 'privacy', 'terms', 'legal',
    'security', 'pricing', 'features', 'faq', 'docs', 'blog', 'status',
    'changelog', 'report', 'abuse',
    -- Framework and crawler paths
    '_next', 'static', 'public', 'assets', 'favicon', 'icon', 'robots',
    'sitemap', 'manifest', 'opengraph-image', 'twitter-image', 'not-found',
    'health', 'healthz',
    -- Brand and impersonation
    'vurlo', 'www', 'mail', 'root', 'null', 'undefined'
  ]);
$$;

revoke all on function public.is_reserved_slug(text) from public;
grant execute on function public.is_reserved_slug(text) to anon, authenticated, service_role;

do $$
declare
  v_slug text;
begin
  select l.slug into v_slug from public.links l where public.is_reserved_slug(l.slug) limit 1;
  if v_slug is not null then
    raise exception 'Existing link uses a newly reserved slug: %. Rename it before applying this migration.', v_slug;
  end if;
end;
$$;
-- Vurlo Phase 8B: abuse prevention + resilience.
--
-- 1. rate_limit_peek(): read a limiter window without counting a request.
--    Sign-in counts FAILED attempts per account (recorded after a wrong
--    password with consume_rate_limit, checked before each attempt with
--    this). Successful sign-ins never count, so people who sign in normally
--    never meet the limit. (Someone deliberately failing 10 times can still
--    pause an account's sign-in for the window; the per-IP caps bound that.)
--
-- 2. Index for the limiter's housekeeping. consume_rate_limit occasionally
--    deletes windows older than a day; without an index on window_start
--    that delete scans the whole table, which is exactly when the table is
--    largest (under attack).

create or replace function public.rate_limit_peek(
  p_key text,
  p_window_seconds integer
)
returns table (count integer, retry_after_seconds integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
begin
  if p_window_seconds < 1 then
    raise exception 'invalid rate limit configuration';
  end if;
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  return query
  select
    coalesce((select r.count from public.rate_limits r where r.key = p_key and r.window_start = v_window_start), 0),
    ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - now())))::integer;
end;
$$;

revoke all on function public.rate_limit_peek(text, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_peek(text, integer) to service_role;

create index if not exists rate_limits_window_start_idx on public.rate_limits (window_start);
-- Vurlo Phase 9: account settings.
--
-- One real preference: the expiry pre-selected when a signed-in user creates
-- a link. It only sets the form's starting value; every create request still
-- sends (and the server still validates) an explicit expiry.
--
-- Owners may update exactly this column on exactly their own profile row.
-- Email lives in auth.users (changed through Supabase Auth, synced here by
-- the existing trigger); created_at and id are not writable.

alter table public.profiles
  add column default_link_expiration text not null default '30d',
  add constraint profiles_default_link_expiration_check
    check (default_link_expiration in ('1d', '7d', '30d', 'never'));

grant update (default_link_expiration) on public.profiles to authenticated;

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
