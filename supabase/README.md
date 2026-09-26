# Supabase

Schema lives in `migrations/`. No Vurlo project is linked yet.

Apply to a project: `supabase link --project-ref <ref>` then `supabase db push`
(or paste the migration into the SQL editor). Then regenerate `types/database.ts`.

Set `SUPABASE_SERVICE_ROLE_KEY` server-side only (never `NEXT_PUBLIC_`).

`npm test` runs the migration against in-process Postgres (PGlite) and checks
constraints, RLS and privileges, so no local Supabase stack is needed.

## Auth setup (Phase 3)

Email/password and Google both go through Supabase Auth. Auth runs entirely
on the server (Server Actions, `proxy.ts`, route handlers); there is no
browser Supabase client and session cookies are `HttpOnly`.

Checklist for a hosted project (mirrors `config.toml`):

1. **URL Configuration**: Site URL = your `NEXT_PUBLIC_APP_URL`. Add
   `<origin>/auth/callback` to Redirect URLs. Nothing else.
2. **Email → Confirm email: ON.** Required so signup and reset don't reveal
   which emails have accounts.
3. **Email templates**: paste `templates/confirmation.html`,
   `templates/recovery.html` and `templates/email-change.html` ("Change
   Email Address"). Keep **Secure email change** on (both addresses confirm). They link to `/auth/confirm?token_hash=…`,
   which works from any device or mail client.
4. **Password**: minimum length 8.
5. **Google**: create an OAuth client (Web). Authorized redirect URI is the
   one Supabase shows on the Google provider page. Paste client id and secret.
6. Sessions: refresh-token rotation ON (default).

Behavior notes: email links are single-use. Some corporate mail scanners
open links before the user does and can consume them; the user then sees
"link expired" and can request a new one.

## Security model (Phase 8A)

The browser never talks to Supabase: every query runs on the server, with
the signed-in user's session (RLS applies) or, for the few writes that need
it, the service role after validation. The anon key is still treated as
public, so the database itself must refuse anything the API shouldn't allow.
`tests/security-db.test.ts` checks this matrix against every migration.

| Table | anon | authenticated | Policy / notes |
| --- | --- | --- | --- |
| `links` | none | `select` own rows; `update` own rows, columns `destination_url, status, expires_at, utm_*, slug` only | `links_select_own`, `links_update_own` (`user_id = auth.uid()`, both `using` and `with check`). No insert/delete grants: creation goes through the server (service role), delete is a status change. Triggers: deleted rows are terminal, 50-active limit, slug retirement. CHECKs: http(s) only, no credentials/whitespace, length, reserved slugs, slug format, UTM hygiene. |
| `link_events` | none | none | RLS on, no policies. Written only by `record_link_event` (service role), read only through aggregate functions. |
| `profiles` | none | `select` own row; `update` own row, column `default_link_expiration` only | `profiles_select_own`, `profiles_update_own`. Email and dates are written only by `auth.users` triggers. |
| `rate_limits` | none | none | Service role only (`consume_rate_limit`). Keys are salted hashes. |
| `retired_slugs` | none | none | Maintained by the link update trigger. |

Functions callable from the API (everything else is service-role only, and
new functions are not executable by API roles unless a migration grants it):

- **anon**: `resolve_link` (status + destination for active links only; no ids, owner or timestamps), plus pure helpers `effective_link_status`, `is_reserved_slug`.
- **authenticated**: `list_my_links`, `my_link_stats` (security invoker, RLS applies); `owns_link`, `my_link_metrics`, `my_link_timeseries`, `my_link_breakdown`, `my_account_metrics`, `my_links_clicks`, `my_account_timeseries`, `my_top_links`, `my_recent_activity` (security definer with an explicit `auth.uid()` ownership predicate; another user's link returns nothing, only aggregates ever leave); `active_link_limit`, `max_slug_changes`.
- **service role only**: `record_link_event`, `consume_rate_limit`, `is_slug_taken`.
