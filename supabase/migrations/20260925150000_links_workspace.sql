-- Vurlo Phase 4A: active-link limit + workspace queries.

-- ---------------------------------------------------------------------------
-- 50 active links per account.
--
-- "Active" means status = 'active' AND not yet expired. Expired, disabled,
-- archived and deleted links free their slot. Enforced here, in the database,
-- so it holds for every write path (server actions, the create API, or any
-- direct call with a user's own token). A per-user advisory lock serializes
-- concurrent writers so two requests can't both take the last slot.
-- ---------------------------------------------------------------------------
create or replace function public.active_link_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 50 $$;

create or replace function public.enforce_active_link_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
begin
  -- Only writes that leave the link active and unexpired can use a slot.
  if new.user_id is null
     or new.status <> 'active'
     or (new.expires_at is not null and new.expires_at <= now()) then
    return new;
  end if;

  -- Updating a link that already held a slot doesn't need another one.
  if tg_op = 'UPDATE'
     and old.user_id is not distinct from new.user_id
     and old.status = 'active'
     and (old.expires_at is null or old.expires_at > now()) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select count(*) into v_used
  from public.links l
  where l.user_id = new.user_id
    and l.status = 'active'
    and (l.expires_at is null or l.expires_at > now())
    and l.id <> new.id;

  if v_used >= public.active_link_limit() then
    raise exception 'active_link_limit_reached'
      using errcode = 'P0001',
            hint = 'This account already has the maximum number of active links.';
  end if;
  return new;
end;
$$;

create trigger links_enforce_active_limit
  before insert or update of status, expires_at, user_id on public.links
  for each row execute function public.enforce_active_link_limit();

revoke all on function public.enforce_active_link_limit() from public, anon, authenticated;
revoke all on function public.active_link_limit() from public, anon;
grant execute on function public.active_link_limit() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Workspace listing. SECURITY INVOKER: row level security still applies, and
-- the explicit user_id predicate is belt and braces. One round trip returns a
-- page of rows plus the total match count, so the browser never receives more
-- than one page. Search input is treated as literal text (LIKE wildcards are
-- escaped) and is only ever a bound parameter.
--
--   p_filter: all | active | expiring | expired | disabled | archived
--   p_sort:   newest | oldest | updated | expiring
-- ---------------------------------------------------------------------------
create or replace function public.list_my_links(
  p_search text default null,
  p_filter text default 'all',
  p_sort   text default 'newest',
  p_limit  integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  destination_url text,
  is_custom_alias boolean,
  status text,
  effective_status text,
  expires_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select l.*, public.effective_link_status(l.status, l.expires_at) as eff
    from public.links l
    where l.user_id = (select auth.uid())
      and l.status <> 'deleted'
  ),
  needle as (
    select case
      when nullif(btrim(p_search), '') is null then null
      else '%' || replace(replace(replace(left(btrim(p_search), 200), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    end as pattern
  ),
  filtered as (
    select m.*
    from mine m, needle n
    where (
      case p_filter
        when 'all'      then m.eff in ('active', 'expired', 'disabled')
        when 'active'   then m.eff = 'active'
        when 'expiring' then m.eff = 'active' and m.expires_at is not null
                             and m.expires_at <= now() + interval '7 days'
        when 'expired'  then m.eff = 'expired'
        when 'disabled' then m.eff = 'disabled'
        when 'archived' then m.eff = 'archived'
        else false
      end
    )
    and (
      n.pattern is null
      or m.slug ilike n.pattern escape '\'
      or m.destination_url ilike n.pattern escape '\'
    )
  )
  select
    f.id, f.slug, f.destination_url, f.is_custom_alias, f.status, f.eff,
    f.expires_at, f.utm_source, f.utm_medium, f.utm_campaign,
    f.created_at, f.updated_at,
    count(*) over () as total_count
  from filtered f
  order by
    case when p_sort = 'oldest'   then f.created_at end asc,
    case when p_sort = 'updated'  then f.updated_at end desc,
    case when p_sort = 'expiring' then f.expires_at end asc nulls last,
    f.created_at desc,
    f.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Counts for the dashboard and the filter tabs, in one query.
create or replace function public.my_link_stats()
returns table (
  total bigint,     -- everything not deleted
  listed bigint,    -- the default "All" view: active + expired + disabled
  active bigint,
  expiring bigint,  -- active and expiring within 7 days
  expired bigint,
  disabled bigint,
  archived bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select public.effective_link_status(l.status, l.expires_at) as eff, l.expires_at
    from public.links l
    where l.user_id = (select auth.uid()) and l.status <> 'deleted'
  )
  select
    count(*),
    count(*) filter (where eff in ('active', 'expired', 'disabled')),
    count(*) filter (where eff = 'active'),
    count(*) filter (where eff = 'active' and expires_at is not null and expires_at <= now() + interval '7 days'),
    count(*) filter (where eff = 'expired'),
    count(*) filter (where eff = 'disabled'),
    count(*) filter (where eff = 'archived')
  from mine;
$$;

revoke all on function public.list_my_links(text, text, text, integer, integer) from public, anon;
revoke all on function public.my_link_stats() from public, anon;
grant execute on function public.list_my_links(text, text, text, integer, integer) to authenticated;
grant execute on function public.my_link_stats() to authenticated;
