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
