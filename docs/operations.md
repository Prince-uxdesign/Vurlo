# Vurlo operations: abuse controls, resilience, monitoring

For whoever runs Vurlo in production. Covers how abuse is limited, how the
app degrades when something fails, and what the logs tell you.

## Rate limiting: three layers

| Layer | Where | What it stops | State |
| --- | --- | --- | --- |
| Edge (recommended) | Vercel Firewall rule | Floods before they reach the app | Vercel |
| Burst | `lib/security/burst.ts`, in memory per instance | Machine-speed loops (several requests a second). Refused before any database work. | Memory, bounded (10k keys) |
| Durable | `consume_rate_limit()` in Postgres | Slower sustained abuse, across all instances | `rate_limits` table, one row per key per window, pruned daily |

Product limits are separate from all of this: **50 active links per
account** is a plan rule enforced by a database trigger, not a security
control.

| Action | Burst | Durable | If the limiter is down |
| --- | --- | --- | --- |
| Create link, anonymous | 5 / 10s per IP | 20 / hour per IP | refuse (503) |
| Create link, signed in | 10 / 10s per account | 60 / hour per account | refuse (503) |
| Alias availability | 10 / 10s per IP | 60 / 10 min per IP | say "unchecked"; creation still verifies |
| Edit / status change | 20 / 10s per account | 120 / 10 min per account | allow (own rows, RLS still applies) |
| Sign in | 10 / min per IP (all auth forms) | 20 / 15 min per IP; 10 **failed** / 15 min per account | allow (Supabase limits still apply) |
| Sign up | as above | 5 / hour per IP | allow |
| Password reset | as above | 5 / hour per IP; 3 / hour per address (silent) | allow |
| Analytics loads | 30 DB loads / min per account (cached views are free) | none | cached copy, or "try again shortly" |

Keys are salted hashes (raw IPs and emails are never stored). Client IP is
the first `x-forwarded-for` hop, which Vercel overwrites. Behind any other
proxy, make sure it does the same, or the IP limits can be spoofed.

**Suggested Vercel Firewall rules:** rate-limit `POST /api/links` and
`GET /api/links/alias` at the edge (e.g. 60/min per IP), and enable
the platform's bot protection. The redirect path (`/[slug]`) should only
get a generous rule (e.g. 600/min per IP): it must stay fast for real
traffic.

**Progressive sign-in:** only failed passwords count per account, so people
who sign in normally never meet the limit. After 3 misses the error
suggests a password reset; after 10 in 15 minutes, sign-in for that account
pauses with a countdown. Trade-off: someone deliberately failing 10 times
can pause an account's sign-in for up to 15 minutes (bounded by the per-IP
caps); password reset still works during the pause. If
credential stuffing becomes a real problem, the next step is Supabase's
built-in CAPTCHA (Cloudflare Turnstile) on the auth endpoints.

## Graceful degradation

| Failure | What users see |
| --- | --- |
| Analytics write fails | Nothing. Clicks are recorded after the redirect response is sent (`after()`), with the service role; errors are logged, never thrown. |
| Database slow or down during a redirect | Redirect lookups time out at 2.5s, retry once on transport errors, then show "We can't open this link right now" with a retry button. Never a hang, never a stack trace. |
| Unsafe stored destination | Same temporary-problem page; no redirect (`unsafe_stored_destination` logged). |
| A dashboard section fails | That section shows "couldn't load" with a retry. Create link, counts and every other section keep working. |
| Link analytics fail | The Performance section shows a retry; the link's settings, copy, edit and QR still work. |
| Analytics hammered | Cached copy for up to a minute; past the per-user throttle, "wait a moment". |
| QR code fails | The QR dialog shows an error with retry; the link and its copy button are unaffected (QR is generated in the browser, lazily). |
| Any Supabase call hangs | Cut off by `lib/supabase/fetch.ts` (2.5s redirect, 8s elsewhere). |

## Scheduled jobs

| Job | Schedule | Needs |
| --- | --- | --- |
| Purge click events older than 90 days (`/api/cron/purge-events` → `purge_expired_link_events`) | Daily 03:00 UTC (`vercel.json`) | `CRON_SECRET` set in the Vercel project. Vercel Cron sends it as `Authorization: Bearer …`. |

The purge fails closed: without `CRON_SECRET` every call is refused (503,
`cron_secret_not_configured` logged), so the privacy policy's 90-day
retention only holds while the secret is configured. A wrong or missing
header gets 401 and logs `unauthorized_cron_attempt`.

## Log events

Every line is JSON: `level`, `event`, context fields, and for errors a
sanitized `error` (`name`, `code`, `status`, `hint`, redacted `message`).
Security signals also carry `"kind":"security"` at `warn` level.

| Area | Event | Level | Suggested alert |
| --- | --- | --- | --- |
| Redirects | `resolve_link_failed` (`transport: true` = timeout/connection) | error | > 1% of redirects over 5 min |
| Redirects | `unsafe_stored_destination` | error | any |
| Creation | `create_link_failed`, `rate_limit_failed` | error | any sustained rate |
| Creation | `link_created` (`signedIn`, `customAlias`, `destinationHost`) | warn/security | spike from one destination host (spam/phishing campaign) |
| Analytics | `record_link_event_failed`, `dashboard_query_failed`, `link_analytics_failed` | error | sustained rate |
| Auth | `auth_failed` (`flow`, `reason`) | warn/security | spike in `invalid_credentials` (credential stuffing) |
| Auth | `sign_in_failed`, `sign_up_failed`, `password_reset_failed`, `oauth_*`, `email_link_verify_failed` | error | sustained rate |
| Abuse | `rate_limited` (`scope`) | warn/security | spike on one scope |
| Account | `password_changed`, `email_change_requested`, `signed_out_everywhere` | warn/security | unusual volume for one account (possible takeover) |
| Account | `settings_password_failed`, `settings_email_failed`, `settings_reauth_failed`, `save_preferences_failed`, `sign_out_everywhere_failed` | error | any sustained rate |
| Abuse | `cross_origin_refused` | warn/security | any sustained rate |
| Config | `salt_not_configured` | error | any (set the variable) |
| Anything else | `unhandled_server_error` (`route`, `routeType`, `digest`) | error | any; `digest` matches the code users see on the error page |

**Never logged:** passwords, session cookies or tokens, API keys, raw IPs,
email addresses, full destination URLs, query strings, request headers or
bodies, Postgres row details. `sanitizeError()` and `redact()` in
`lib/links/log.ts` enforce this for error text. To ship these logs to an
error tracker, forward the same objects: they are already safe.
