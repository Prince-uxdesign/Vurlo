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
