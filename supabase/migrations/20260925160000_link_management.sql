-- Vurlo Phase 4B: link management rules the database enforces itself.
--
-- 1. Deleted is terminal. A deleted link can't be edited, re-enabled or
--    renamed by anyone, whatever path the write takes.
-- 2. Owners may change a link's slug (its public address). The old slug is
--    retired, not freed: it stops resolving, and nobody else can ever claim
--    it, so traffic from old QR codes and shares can't be hijacked. The same
--    link may move back to one of its own retired slugs.
-- 3. A link can change address at most 5 times, so renaming can't be used
--    to squat on slugs.

-- ---------------------------------------------------------------------------
-- Retired slugs
-- ---------------------------------------------------------------------------
create table public.retired_slugs (
  slug       text primary key,
  link_id    uuid not null references public.links (id) on delete cascade,
  retired_at timestamptz not null default now()
);

comment on table public.retired_slugs is
  'Former slugs of links that changed address. Never resolve, never reusable by another link.';

create index retired_slugs_link_id_idx on public.retired_slugs (link_id);

-- Written only by the trigger below. Nobody reads it directly.
alter table public.retired_slugs enable row level security;
revoke all on table public.retired_slugs from public, anon, authenticated;
grant all on table public.retired_slugs to service_role;

create or replace function public.max_slug_changes()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

-- Owners can now write the slug column too (RLS still limits them to their
-- own rows). user_id, id, is_custom_alias and timestamps stay off limits.
grant update (slug) on public.links to authenticated;

-- Raised for a retired slug so every caller treats it exactly like a taken one.
create or replace function public.raise_slug_taken()
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'duplicate key value violates unique constraint "links_slug_key"'
    using errcode = 'unique_violation', detail = 'slug is retired';
end;
$$;

-- ---------------------------------------------------------------------------
-- Inserts: a retired slug can't be claimed. The advisory lock pairs with the
-- one taken while renaming, so a create can't slip in between a rename
-- freeing the slug in `links` and retiring it here.
-- ---------------------------------------------------------------------------
create or replace function public.guard_link_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('slug:' || new.slug, 0));
  if exists (select 1 from public.retired_slugs r where r.slug = new.slug) then
    perform public.raise_slug_taken();
  end if;
  return new;
end;
$$;

create trigger links_guard_insert
  before insert on public.links
  for each row execute function public.guard_link_insert();

-- ---------------------------------------------------------------------------
-- Updates
-- ---------------------------------------------------------------------------
create or replace function public.guard_link_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes integer;
begin
  if old.status = 'deleted' then
    raise exception 'link_deleted'
      using errcode = 'P0001', hint = 'Deleted links cannot be changed.';
  end if;

  if new.slug is distinct from old.slug then
    -- Lock both addresses in a fixed order (no deadlock between two renames).
    perform pg_advisory_xact_lock(hashtextextended('slug:' || least(old.slug, new.slug), 0));
    perform pg_advisory_xact_lock(hashtextextended('slug:' || greatest(old.slug, new.slug), 0));

    if exists (
      select 1 from public.retired_slugs r where r.slug = new.slug and r.link_id <> new.id
    ) then
      perform public.raise_slug_taken();
    end if;

    -- Moving back to one of this link's own old addresses doesn't use a change.
    delete from public.retired_slugs r where r.slug = new.slug and r.link_id = new.id;

    select count(*) into v_changes from public.retired_slugs r where r.link_id = new.id;
    if v_changes >= public.max_slug_changes() then
      raise exception 'slug_change_limit_reached'
        using errcode = 'P0001', hint = 'This link has changed address too many times.';
    end if;

    insert into public.retired_slugs (slug, link_id) values (old.slug, new.id)
      on conflict (slug) do nothing;
    -- Any slug the owner picked is, by definition, a custom alias.
    new.is_custom_alias := true;
  end if;
  return new;
end;
$$;

-- Same-event triggers fire in name order; this name sorts first, so a deleted
-- link is refused before the active-limit check runs.
create trigger links_a_guard_update
  before update on public.links
  for each row execute function public.guard_link_update();

-- ---------------------------------------------------------------------------
-- Advisory availability for the alias field: taken, retired or reserved.
-- Server only (service role): it must not become a free enumeration oracle.
-- ---------------------------------------------------------------------------
create or replace function public.is_slug_taken(p_slug text)
returns table (taken boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_reserved_slug(lower(p_slug))
      or exists (select 1 from public.links l where l.slug = lower(p_slug))
      or exists (select 1 from public.retired_slugs r where r.slug = lower(p_slug));
$$;

revoke all on function public.max_slug_changes() from public, anon;
revoke all on function public.raise_slug_taken() from public, anon, authenticated;
revoke all on function public.guard_link_insert() from public, anon, authenticated;
revoke all on function public.guard_link_update() from public, anon, authenticated;
revoke all on function public.is_slug_taken(text) from public, anon, authenticated;
grant execute on function public.max_slug_changes() to authenticated, service_role;
grant execute on function public.is_slug_taken(text) to service_role;
