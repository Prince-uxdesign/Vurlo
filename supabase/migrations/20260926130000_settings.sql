-- Vurlo Phase 9: account settings.
--
-- One real preference: the expiry pre-selected when a signed-in user creates
-- a link. It only sets the form's starting value; every create request still
-- sends (and the server still validates) an explicit expiry.
--
-- Owners may update exactly this column on exactly their own profile row.
-- Email lives in auth.users (changed through Supabase Auth, synced here by
-- the existing trigger); created_at and id are not writable.

alter table public.profiles
  add column default_link_expiration text not null default '30d',
  add constraint profiles_default_link_expiration_check
    check (default_link_expiration in ('1d', '7d', '30d', 'never'));

grant update (default_link_expiration) on public.profiles to authenticated;

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
