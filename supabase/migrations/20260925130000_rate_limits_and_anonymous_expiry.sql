-- Vurlo Phase 2B: baseline abuse controls for anonymous shortening.

-- ---------------------------------------------------------------------------
-- Anonymous links always expire, within ~30 days (MVP rule).
-- Owned links (user_id set) may have no expiry. The one-day slack absorbs
-- clock skew between the app server (which computes expires_at) and the
-- database (which sets created_at); the app itself caps at 30 days.
-- ---------------------------------------------------------------------------
alter table public.links
  add constraint links_anonymous_must_expire
    check (user_id is not null or expires_at is not null),
  add constraint links_anonymous_max_lifetime
    check (user_id is not null or expires_at <= created_at + interval '31 days');

-- ---------------------------------------------------------------------------
-- Fixed-window rate limiting shared by every server instance.
-- `key` is an opaque, salted hash chosen by the app (never a raw IP).
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (key, window_start)
);

comment on table public.rate_limits is
  'Fixed-window request counters. Server (service role) only.';

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from public, anon, authenticated;
grant all on table public.rate_limits to service_role;

-- Atomically counts one request and reports whether it is within the limit.
-- Rejected requests still count, so hammering a limit doesn't reset it.
create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit configuration';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;

  -- Cheap housekeeping: no cron job needed for an MVP-sized table.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return query select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - now())))::integer;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
