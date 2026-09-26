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
