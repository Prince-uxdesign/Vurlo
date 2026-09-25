-- Vurlo Phase 3: minimal profile row per account.
--
-- Deliberately tiny: id, email, created_at. Auth data (password hashes,
-- sessions, identities) stays in Supabase's auth schema, untouched. This
-- table exists so app tables and screens can read "who is this user" through
-- normal RLS without reaching into the auth schema.

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per account, created by trigger. Minimal by design.';

alter table public.profiles enable row level security;

-- Users may read only their own profile. Nobody writes profiles directly:
-- rows are created and synced by the security-definer triggers below.
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Keep profiles in step with auth.users
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, created_at)
  values (new.id, new.email, coalesce(new.created_at, now()))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Trigger functions are never called directly.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;

-- Backfill any accounts that existed before this migration.
insert into public.profiles (id, email, created_at)
select id, email, coalesce(created_at, now()) from auth.users
on conflict (id) do nothing;
