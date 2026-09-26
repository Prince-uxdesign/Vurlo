import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminClient } from "@/lib/supabase/admin";
import {
  normalizeDestination,
  resolveExpiration,
  validateAlias,
  validateUtm,
} from "@/lib/validation/link-input";
import { trackedUrlTooLong } from "@/lib/validation/utm";
import { generateSlug } from "./generate-slug";
import { ACTIVE_LINK_LIMIT } from "./list-params";
import { logServerError } from "./log";
import { isReservedSlug } from "./reserved-slugs";
import type {
  CreatedLinkRecord,
  LinkCreationErrorCode,
  LinkCreationInput,
  LinkCreationResult,
  LinkField,
} from "./types";

const MAX_SLUG_ATTEMPTS = 5;
const SLUG_UNIQUE_CONSTRAINT = "links_slug_key";

interface CreateLinkOptions {
  /** The verified session user (never taken from the request body). Unset = anonymous link. */
  userId?: string;
  /** Injected in tests. Defaults to the service-role client. */
  client?: AdminClient | null;
  now?: Date;
  /** Injected in tests to force collisions. */
  slugGenerator?: () => string;
}

const fail = (
  code: LinkCreationErrorCode,
  field: LinkField,
  error: string,
): LinkCreationResult => ({ ok: false, code, field, error });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates untrusted input, then inserts a link. This is the only write
 * path for links; POST /api/links (lib/links/api.ts) calls it after rate
 * limiting.
 *
 * `input` is typed `unknown` on purpose. It comes from a request body, so
 * every field is re-validated here regardless of what the UI checked.
 */
export async function createLink(
  input: unknown,
  options: CreateLinkOptions = {},
): Promise<LinkCreationResult> {
  if (!isRecord(input)) {
    return fail("invalid_destination", "destination", "Paste a URL to shorten.");
  }
  const raw = input as Partial<LinkCreationInput> & Record<string, unknown>;

  const destination = normalizeDestination(
    typeof raw.destination === "string" ? raw.destination : "",
  );
  if (!destination.ok) return fail(destination.code, "destination", destination.error);

  const alias = validateAlias(typeof raw.alias === "string" ? raw.alias : undefined);
  if (!alias.ok) return fail(alias.code, "alias", alias.error);
  if (raw.alias !== undefined && typeof raw.alias !== "string") {
    return fail("invalid_alias", "alias", "Alias must be text.");
  }

  if (raw.expiration !== undefined && typeof raw.expiration !== "string") {
    return fail("invalid_expiration", "expiration", "Choose a valid expiry option.");
  }
  const expiresAt = resolveExpiration(
    raw.expiration as LinkCreationInput["expiration"],
    { now: options.now, allowNever: Boolean(options.userId) },
  );
  if (!expiresAt.ok) return fail(expiresAt.code, "expiration", expiresAt.error);

  const utm = validateUtm(isRecord(raw.utm) ? raw.utm : undefined);
  if (!utm.ok) return fail(utm.code, "utm", utm.error);
  const tooLong = trackedUrlTooLong(destination.value, utm.value);
  if (tooLong) return fail("invalid_utm", "utm", tooLong);

  const client = options.client === undefined ? createAdminClient() : options.client;
  if (!client) {
    return fail("not_configured", "form", "Link creation isn't available right now.");
  }

  const isCustomAlias = alias.value !== undefined;
  const attempts = isCustomAlias ? 1 : MAX_SLUG_ATTEMPTS;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const slug = alias.value ?? (options.slugGenerator ?? generateSlug)();
    if (!isCustomAlias && isReservedSlug(slug)) continue;

    const { data, error } = await client
      .from("links")
      .insert({
        user_id: options.userId ?? null,
        destination_url: destination.value,
        slug,
        is_custom_alias: isCustomAlias,
        expires_at: expiresAt.value,
        utm_source: utm.value.source,
        utm_medium: utm.value.medium,
        utm_campaign: utm.value.campaign,
      })
      .select(
        "slug, destination_url, is_custom_alias, expires_at, utm_source, utm_medium, utm_campaign",
      )
      .single();

    if (!error && data) {
      const link: CreatedLinkRecord = {
        slug: data.slug,
        destinationUrl: data.destination_url,
        isCustomAlias: data.is_custom_alias,
        expiresAt: data.expires_at,
        utmSource: data.utm_source,
        utmMedium: data.utm_medium,
        utmCampaign: data.utm_campaign,
      };
      return { ok: true, link };
    }

    // Unique violation on the slug: a custom alias is taken, or a random slug
    // collided. Retry only for generated slugs.
    const isSlugCollision =
      error?.code === "23505" && (error.message ?? "").includes(SLUG_UNIQUE_CONSTRAINT);
    if (isSlugCollision) {
      if (isCustomAlias) {
        return fail("alias_taken", "alias", "That alias is already taken. Try a different one.");
      }
      continue;
    }

    if (error?.message?.includes("active_link_limit_reached")) {
      return fail(
        "limit_reached",
        "form",
        `You've reached the limit of ${ACTIVE_LINK_LIMIT} active links. Disable, archive or delete a link to make room.`,
      );
    }

    // Full detail for developers; callers only get a safe message.
    logServerError("create_link_failed", error, { code: error?.code });
    return fail("unknown", "form", "Something went wrong creating your link. Try again.");
  }

  return fail("slug_generation_failed", "form", "Couldn't create a link right now. Try again.");
}
