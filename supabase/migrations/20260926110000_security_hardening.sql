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
