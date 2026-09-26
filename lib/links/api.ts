import "server-only";
import { siteConfig } from "@/config/site";
import { BURST, burst as sharedBurst } from "@/lib/security/burst";
import type { createBurstLimiter } from "@/lib/security/burst";
import { waitPhrase } from "@/lib/security/wait";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminClient } from "@/lib/supabase/admin";
import { applyUtm, validateAlias } from "@/lib/validation/link-input";
import type {
  AliasCheckResponse,
  CreateLinkApiResponse,
} from "./api-types";
import { createLink } from "./create-link";
import { logSecurityEvent, logServerError } from "./log";
import { ALIAS_CHECK_LIMIT, CREATE_LINK_LIMIT, CREATE_LINK_USER_LIMIT } from "./limits";
import { consumeRateLimit } from "./rate-limit";
import type { RateLimitResult } from "./rate-limit";
import { getClientIp, isSameOrigin, rateLimitKey, readJsonBody } from "./request";
import type { LinkCreationErrorCode } from "./types";

/**
 * Request handlers for the anonymous link API. Route files stay one-liners;
 * everything testable lives here, with the database client injectable.
 */
export interface ApiDeps {
  client?: AdminClient | null;
  /** Verified id of the signed-in user, if any. Resolved by the route, never read from the body. */
  userId?: string | null;
  now?: Date;
  /** In-memory burst layer. Injected in tests; defaults to the process-wide one. */
  burst?: ReturnType<typeof createBurstLimiter>;
}

const STATUS_BY_CODE: Record<LinkCreationErrorCode, number> = {
  invalid_destination: 400,
  invalid_alias: 400,
  reserved_alias: 400,
  invalid_expiration: 400,
  invalid_utm: 400,
  alias_taken: 409,
  limit_reached: 409,
  not_configured: 503,
  slug_generation_failed: 503,
  unknown: 500,
};

function json(body: unknown, status: number, headers: HeadersInit = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function createError(
  status: number,
  body: Extract<CreateLinkApiResponse, { ok: false }>,
  headers?: HeadersInit,
) {
  return json(body, status, headers);
}

/**
 * Counts one request against a limit. `subject` defaults to the client IP;
 * signed-in callers pass their user id. Keys are salted hashes either way.
 */
async function limitOrNull(
  client: AdminClient,
  scope: string,
  request: Request,
  config: { limit: number; windowSeconds: number },
  subject?: string,
): Promise<{ result: RateLimitResult } | { failed: true }> {
  try {
    const key = await rateLimitKey(scope, subject ?? getClientIp(request.headers));
    const result = await consumeRateLimit(client, key, config);
    if (!result.allowed) logSecurityEvent("rate_limited", { scope, signedIn: Boolean(subject) });
    return { result };
  } catch (error) {
    logServerError("rate_limit_failed", error, { scope });
    return { failed: true };
  }
}

export async function handleCreateLinkRequest(
  request: Request,
  deps: ApiDeps = {},
): Promise<Response> {
  if (!isSameOrigin(request)) {
    logSecurityEvent("cross_origin_refused", { route: "create" });
    return createError(403, {
      ok: false,
      code: "bad_request",
      field: "form",
      error: "This request wasn't allowed.",
    });
  }

  const client = deps.client === undefined ? createAdminClient() : deps.client;
  if (!client) {
    return createError(503, {
      ok: false,
      code: "not_configured",
      field: "form",
      error: "Link creation isn't available right now. Try again soon.",
    });
  }

  // Rate limit before doing any other work. Fails closed: if the limiter
  // itself is down we refuse rather than allow unmetered anonymous writes.
  // Layer 1: refuse machine-speed bursts in memory, before any database work.
  const who = deps.userId ? `user:${deps.userId}` : `ip:${getClientIp(request.headers)}`;
  const quick = (deps.burst ?? sharedBurst).hit(`create:${who}`, deps.userId ? BURST.createSignedIn : BURST.createAnonymous);
  if (!quick.allowed) {
    logSecurityEvent("rate_limited", { scope: "create-burst", signedIn: Boolean(deps.userId) });
    return createError(
      429,
      {
        ok: false,
        code: "rate_limited",
        field: "form",
        error: `You're creating links too quickly. Please wait ${waitPhrase(quick.retryAfterSeconds)} and try again.`,
        retryAfterSeconds: quick.retryAfterSeconds,
      },
      { "Retry-After": String(quick.retryAfterSeconds) },
    );
  }

  // Layer 2: the durable hourly cap, shared by every server instance.
  const limited = deps.userId
    ? await limitOrNull(client, "create-user", request, CREATE_LINK_USER_LIMIT, deps.userId)
    : await limitOrNull(client, "create", request, CREATE_LINK_LIMIT);
  if ("failed" in limited) {
    return createError(503, {
      ok: false,
      code: "unavailable",
      field: "form",
      error: "Link creation is temporarily unavailable. Try again in a moment.",
    });
  }
  if (!limited.result.allowed) {
    const retryAfterSeconds = limited.result.retryAfterSeconds;
    return createError(
      429,
      {
        ok: false,
        code: "rate_limited",
        field: "form",
        error: `You've made a lot of links in the last hour. You can create more in ${waitPhrase(retryAfterSeconds)}.`,
        retryAfterSeconds,
      },
      { "Retry-After": String(retryAfterSeconds) },
    );
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return createError(body.reason === "too_large" ? 413 : 400, {
      ok: false,
      code: "bad_request",
      field: "form",
      error:
        body.reason === "too_large"
          ? "That request is too large."
          : "We couldn't read that request. Reload the page and try again.",
    });
  }

  const result = await createLink(body.value, { client, now: deps.now, userId: deps.userId ?? undefined });
  if (!result.ok) {
    return createError(STATUS_BY_CODE[result.code], {
      ok: false,
      code: result.code,
      field: result.field,
      error: result.error,
    });
  }

  const { link } = result;
  logSecurityEvent("link_created", {
    signedIn: Boolean(deps.userId),
    customAlias: link.isCustomAlias,
    destinationHost: new URL(link.destinationUrl).hostname,
  });
  const displayUrl = `${siteConfig.shortLinkHost}/${link.slug}`;
  return json(
    {
      ok: true,
      link: {
        slug: link.slug,
        shortUrl: `${new URL(siteConfig.url).origin}/${link.slug}`,
        displayUrl,
        destinationUrl: applyUtm(link.destinationUrl, {
          source: link.utmSource,
          medium: link.utmMedium,
          campaign: link.utmCampaign,
        }),
        expiresAt: link.expiresAt,
        isCustomAlias: link.isCustomAlias,
        savedToAccount: Boolean(deps.userId),
      },
    } satisfies CreateLinkApiResponse,
    201,
  );
}

/**
 * Advisory availability check for the alias field. It is not a reservation:
 * the create call remains authoritative and can still answer `alias_taken`.
 */
export async function handleAliasCheckRequest(
  request: Request,
  deps: ApiDeps = {},
): Promise<Response> {
  const respond = (body: AliasCheckResponse, status = 200, headers?: HeadersInit) =>
    json(body, status, headers);

  if (!isSameOrigin(request)) {
    logSecurityEvent("cross_origin_refused", { route: "alias" });
    return respond({ status: "error", error: "This request wasn't allowed." }, 403);
  }

  const rawAlias = new URL(request.url).searchParams.get("alias") ?? "";
  // Anything longer than a slug can be is invalid without further work.
  const alias = validateAlias(rawAlias.length > 64 ? "!" : rawAlias);
  if (!alias.ok) {
    return respond(
      { status: alias.code === "reserved_alias" ? "reserved" : "invalid", error: alias.error },
      400,
    );
  }
  if (alias.value === undefined) {
    return respond({ status: "invalid", error: "Enter an alias to check." }, 400);
  }

  const client = deps.client === undefined ? createAdminClient() : deps.client;
  if (!client) {
    return respond({ status: "error", error: "Availability can't be checked right now." }, 503);
  }

  const slowDown = (retryAfterSeconds: number) =>
    respond(
      { status: "rate_limited", error: `You're checking aliases quickly. Wait ${waitPhrase(retryAfterSeconds)}, or just create the link: we'll confirm the alias then.` },
      429,
      { "Retry-After": String(retryAfterSeconds) },
    );
  const quick = (deps.burst ?? sharedBurst).hit(`alias:${getClientIp(request.headers)}`, BURST.aliasCheck);
  if (!quick.allowed) {
    logSecurityEvent("rate_limited", { scope: "alias-burst" });
    return slowDown(quick.retryAfterSeconds);
  }

  const limited = await limitOrNull(client, "alias", request, ALIAS_CHECK_LIMIT);
  if ("failed" in limited) {
    return respond({ status: "error", error: "Availability can't be checked right now." }, 503);
  }
  if (!limited.result.allowed) return slowDown(limited.result.retryAfterSeconds);

  // Live, deleted and retired (a link's former address) slugs all count as taken.
  const { data, error } = await client.rpc("is_slug_taken", { p_slug: alias.value });
  if (error || !data?.[0]) {
    logServerError("alias_check_failed", error, { code: error?.code });
    return respond({ status: "error", error: "Availability can't be checked right now." }, 500);
  }
  return respond({ status: data[0].taken ? "taken" : "available" });
}
