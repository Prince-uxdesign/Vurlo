import "server-only";
import { siteConfig } from "@/config/site";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminClient } from "@/lib/supabase/admin";
import { applyUtm, validateAlias } from "@/lib/validation/link-input";
import type {
  AliasCheckResponse,
  CreateLinkApiResponse,
} from "./api-types";
import { createLink } from "./create-link";
import { logServerError } from "./log";
import { ALIAS_CHECK_LIMIT, CREATE_LINK_LIMIT } from "./limits";
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

/** Returns a Response when the caller should stop, otherwise null. */
async function limitOrNull(
  client: AdminClient,
  scope: string,
  request: Request,
  config: { limit: number; windowSeconds: number },
): Promise<{ result: RateLimitResult } | { failed: true }> {
  try {
    const key = await rateLimitKey(scope, getClientIp(request.headers));
    return { result: await consumeRateLimit(client, key, config) };
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
  const limited = await limitOrNull(client, "create", request, CREATE_LINK_LIMIT);
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
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    return createError(
      429,
      {
        ok: false,
        code: "rate_limited",
        field: "form",
        error: `You've created a lot of links. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
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
    return respond({ status: "error", error: "This request wasn't allowed." }, 403);
  }

  const alias = validateAlias(new URL(request.url).searchParams.get("alias") ?? "");
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

  const limited = await limitOrNull(client, "alias", request, ALIAS_CHECK_LIMIT);
  if ("failed" in limited) {
    return respond({ status: "error", error: "Availability can't be checked right now." }, 503);
  }
  if (!limited.result.allowed) {
    return respond(
      { status: "rate_limited", error: "Too many checks. Slow down for a moment." },
      429,
      { "Retry-After": String(limited.result.retryAfterSeconds) },
    );
  }

  // Live, deleted and retired (a link's former address) slugs all count as taken.
  const { data, error } = await client.rpc("is_slug_taken", { p_slug: alias.value });
  if (error || !data?.[0]) {
    logServerError("alias_check_failed", error, { code: error?.code });
    return respond({ status: "error", error: "Availability can't be checked right now." }, 500);
  }
  return respond({ status: data[0].taken ? "taken" : "available" });
}
