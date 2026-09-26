-- Phase 11: Analytics retention enforcement.
--
-- Deletes raw click events older than a given retention window (default 90 days).
-- Kept behind service_role so it cannot be invoked by clients or public visitors.

create or replace function public.purge_expired_link_events(p_days int default 90)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted bigint;
begin
  if p_days < 1 then
    raise exception 'Retention window must be at least 1 day.';
  end if;

  delete from public.link_events
  where occurred_at < now() - make_interval(days => p_days);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_link_events(int) from public, anon, authenticated;
grant execute on function public.purge_expired_link_events(int) to service_role;

comment on function public.purge_expired_link_events(int) is
  'Purges link_events older than p_days (default 90). Service-role only.';
