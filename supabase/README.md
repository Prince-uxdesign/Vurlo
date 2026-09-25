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
3. **Email templates**: paste `templates/confirmation.html` and
   `templates/recovery.html`. They link to `/auth/confirm?token_hash=…`,
   which works from any device or mail client.
4. **Password**: minimum length 8.
5. **Google**: create an OAuth client (Web). Authorized redirect URI is the
   one Supabase shows on the Google provider page. Paste client id and secret.
6. Sessions: refresh-token rotation ON (default).

Behavior notes: email links are single-use. Some corporate mail scanners
open links before the user does and can consume them; the user then sees
"link expired" and can request a new one.
