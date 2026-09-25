-- Vurlo Phase 2A: core links model.
--
-- One table (public.links), one resolve function, deny-by-default RLS.
-- Anonymous visitors have NO direct table access. Links are created by the
-- server with the service role (which bypasses RLS) and resolved through
-- public.resolve_link(), which returns only what a redirect needs.

-- ---------------------------------------------------------------------------
-- Reserved slugs. Keep in sync with lib/links/reserved-slugs.ts
-- (tests/links-db.test.ts fails if they drift).
-- ---------------------------------------------------------------------------
create or replace function public.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(p_slug) = any (array[
    'api',
    'auth',
    'app',
    'dashboard',
    'links',
    'link',
    'settings',
    'account',
    'profile',
    'login',
    'logout',
    'signin',
    'signup',
    'register',
    'admin',
    'showcase',
    'new',
    'create',
    'edit',
    'preview',
    'qr',
    'analytics',
    'about',
    'help',
    'support',
    'contact',
    'privacy',
    'terms',
    'legal',
    'security',
    'pricing',
    'features',
    'faq',
    'docs',
    'blog',
    'status',
    'changelog',
    'report',
    'abuse',
    '_next',
    'static',
    'public',
    'assets',
    'favicon',
    'icon',
    'robots',
    'sitemap',
    'manifest',
    'opengraph-image',
    'twitter-image',
    'not-found',
    'health',
    'healthz',
    'vurlo',
    'www',
    'mail',
    'root',
    'null',
    'undefined'
  ]);
$$;

-- ---------------------------------------------------------------------------
-- links
-- ---------------------------------------------------------------------------
create table public.links (
  id              uuid primary key default gen_random_uuid(),
  -- Nullable on purpose: anonymous links have no owner. When a user account
  -- is deleted, their links are deleted with it.
  user_id         uuid references auth.users (id) on delete cascade,
  destination_url text not null,
  slug            text not null,
  is_custom_alias boolean not null default false,
  -- Stored lifecycle state. "Expired" is derived from expires_at, see
  -- public.effective_link_status(); no background job flips it.
  status          text not null default 'active',
  expires_at      timestamptz,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Uniqueness is enforced here, not in application code, so concurrent
  -- creates can never issue the same slug. Soft-deleted links keep their
  -- slug, so a deleted slug can't be claimed by someone else.
  constraint links_slug_key unique (slug),
  constraint links_slug_format
    check (slug ~ '^[a-z0-9][a-z0-9_-]{2,31}$'),
  constraint links_slug_not_reserved
    check (not public.is_reserved_slug(slug)),
  -- http(s) only, no whitespace, no userinfo (user:pass@host) in the authority.
  constraint links_destination_url_format
    check (destination_url ~* '^https?://[^\s/?#@]+([/?#]\S*)?$'),
  constraint links_destination_url_length
    check (char_length(destination_url) <= 2048),
  constraint links_status_check
    check (status in ('active', 'expired', 'disabled', 'archived', 'deleted')),
  constraint links_expires_after_created
    check (expires_at is null or expires_at > created_at),
  constraint links_utm_source_length
    check (utm_source is null or char_length(utm_source) between 1 and 100),
  constraint links_utm_medium_length
    check (utm_medium is null or char_length(utm_medium) between 1 and 100),
  constraint links_utm_campaign_length
    check (utm_campaign is null or char_length(utm_campaign) between 1 and 100)
);

comment on table public.links is
  'Short links. user_id is null for anonymous links. Slug is unique and lowercase.';

-- Dashboard listing (future): "my links, newest first". Anonymous rows are excluded.
create index links_user_id_created_at_idx
  on public.links (user_id, created_at desc)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger links_set_updated_at
  before update on public.links
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Deterministic expiry
-- ---------------------------------------------------------------------------
create or replace function public.effective_link_status(
  p_status text,
  p_expires_at timestamptz
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_status = 'active'
         and p_expires_at is not null
         and p_expires_at <= now()
    then 'expired'
    else p_status
  end;
$$;

-- ---------------------------------------------------------------------------
-- Slug resolution for redirects. SECURITY DEFINER so anonymous visitors never
-- need table access. Returns no ids, no owner, no timestamps, and only reveals
-- the destination for links that are currently active.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_link(p_slug text)
returns table (
  status          text,
  destination_url text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.status,
    case when e.status = 'active' then l.destination_url end,
    case when e.status = 'active' then l.utm_source end,
    case when e.status = 'active' then l.utm_medium end,
    case when e.status = 'active' then l.utm_campaign end
  from public.links l
  cross join lateral (
    select public.effective_link_status(l.status, l.expires_at) as status
  ) e
  where l.slug = lower(p_slug)
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Privileges + Row Level Security
-- ---------------------------------------------------------------------------
-- Supabase grants new tables to anon/authenticated by default. Start from zero.
revoke all on table public.links from public, anon, authenticated;

-- Signed-in users (later phases): read their own links and edit a fixed set of
-- columns. They cannot change user_id, slug, or ids, and cannot insert or
-- hard-delete: creation goes through the server, deletion is status = 'deleted'.
grant select on public.links to authenticated;
grant update (destination_url, status, expires_at, utm_source, utm_medium, utm_campaign)
  on public.links to authenticated;

-- The server (service role) creates links. It bypasses RLS by design, so its
-- key must never reach the browser.
grant all on table public.links to service_role;

alter table public.links enable row level security;

-- No policies exist for anon: anonymous visitors cannot read or write rows.
create policy links_select_own
  on public.links for select to authenticated
  using (user_id = (select auth.uid()));

create policy links_update_own
  on public.links for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on function public.resolve_link(text) from public;
revoke all on function public.effective_link_status(text, timestamptz) from public;
revoke all on function public.is_reserved_slug(text) from public;
grant execute on function public.resolve_link(text) to anon, authenticated, service_role;
grant execute on function public.effective_link_status(text, timestamptz) to anon, authenticated, service_role;
grant execute on function public.is_reserved_slug(text) to anon, authenticated, service_role;
