"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedUser } from "@/lib/auth/session";
import { MANAGE_LINK_LIMIT } from "@/lib/links/limits";
import { logSecurityEvent, logServerError } from "@/lib/links/log";
import { ACTIVE_LINK_LIMIT } from "@/lib/links/list-params";
import { consumeRateLimit } from "@/lib/links/rate-limit";
import { rateLimitKey } from "@/lib/links/request";
import { BURST, burst } from "@/lib/security/burst";
import { waitPhrase } from "@/lib/security/wait";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_SLUG_CHANGES, TRANSITIONS, UUID_PATTERN, isStatusAction, validateLinkEdit } from "@/lib/links/manage";
import type { LinkEditErrors, LinkEditInput, StatusAction } from "@/lib/links/manage";
import { createClient } from "@/lib/supabase/server";

/**
 * Owner actions on links. Every call re-verifies the session, re-validates its
 * input, and writes through the caller's own Supabase client, so Row Level
 * Security (owner-only, limited columns) is the enforcement, not this file.
 */
export type ActionResult =
  | { ok: true; message: string; slug?: string }
  | {
      ok: false;
      error: string;
      /** `auth`: the session ended (signed out elsewhere, expired): send them to sign in. */
      code: "limit" | "not_found" | "invalid" | "unavailable" | "auth" | "rate_limited";
      fieldErrors?: LinkEditErrors;
    };

const LIMIT_MESSAGE = `You've reached the limit of ${ACTIVE_LINK_LIMIT} active links. Disable, archive or delete a link to make room.`;
const GENERIC = "Something went wrong. Try again.";
const SIGNED_OUT: ActionResult = { ok: false, error: "Your session has ended. Sign in again to keep managing your links.", code: "auth" };

const DONE: Record<StatusAction, string> = {
  disable: "Link disabled. Visitors will see a “turned off” page.",
  enable: "Link enabled.",
  archive: "Link archived.",
  unarchive: "Link restored.",
  delete: "Link deleted.",
};

const slowDown = (seconds: number): ActionResult => ({
  ok: false,
  error: `You're making changes very quickly. Please wait ${waitPhrase(seconds)} and try again.`,
  code: "rate_limited",
});

/**
 * Per-account throttle on link changes: an in-memory burst guard, then the
 * durable window (MANAGE_LINK_LIMIT). Returns seconds to wait, or 0. The
 * durable check fails open: these are the owner's own rows, RLS still
 * guards every write, and a limiter outage shouldn't lock people out.
 */
async function manageWait(userId: string): Promise<number> {
  const quick = burst.hit(`manage:${userId}`, BURST.manage);
  if (!quick.allowed) {
    logSecurityEvent("rate_limited", { scope: "manage-burst", signedIn: true });
    return quick.retryAfterSeconds;
  }
  const client = createAdminClient();
  if (!client) return 0;
  try {
    const result = await consumeRateLimit(client, await rateLimitKey("manage", userId), MANAGE_LINK_LIMIT);
    if (!result.allowed) logSecurityEvent("rate_limited", { scope: "manage", signedIn: true });
    return result.allowed ? 0 : result.retryAfterSeconds;
  } catch (error) {
    logServerError("manage_rate_limit_failed", error);
    return 0;
  }
}

function refresh() {
  revalidatePath("/links");
  revalidatePath("/links/[id]", "page");
  revalidatePath("/dashboard");
}

type DbError = { code?: string; message?: string } | null;
const isLimitError = (e: DbError) => Boolean(e?.message?.includes("active_link_limit_reached"));
const isSlugTaken = (e: DbError) => e?.code === "23505" && Boolean(e.message?.includes("links_slug_key"));
const isSlugChangeLimit = (e: DbError) => Boolean(e?.message?.includes("slug_change_limit_reached"));
const isDeleted = (e: DbError) => Boolean(e?.message?.includes("link_deleted"));

/**
 * `options.leaving`: the caller navigates away on success (deleting from the
 * link's own page). Skipping revalidation there stops the page being
 * re-rendered as "not found" underneath the user before they leave; every
 * app page is dynamic, so wherever they land is fetched fresh anyway.
 */
export async function setLinkStatusAction(id: string, action: StatusAction, options?: { leaving?: boolean }): Promise<ActionResult> {
  if (typeof id !== "string" || !UUID_PATTERN.test(id) || !isStatusAction(action)) {
    return { ok: false, error: "That request wasn't valid.", code: "invalid" };
  }
  const user = await getVerifiedUser();
  if (!user) return SIGNED_OUT;
  const wait = await manageWait(user.id);
  if (wait > 0) return slowDown(wait);
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: GENERIC, code: "unavailable" };

  const { from, to } = TRANSITIONS[action];
  const { data, error } = await supabase
    .from("links")
    .update({ status: to })
    .eq("id", id)
    .in("status", [...from])
    .select("id");

  if (error) {
    if (isLimitError(error)) return { ok: false, error: LIMIT_MESSAGE, code: "limit" };
    if (isDeleted(error)) {
      refresh();
      return { ok: false, error: "This link was deleted. The list has been refreshed.", code: "not_found" };
    }
    logServerError("link_status_update_failed", error, { action, code: error.code });
    return { ok: false, error: GENERIC, code: "unavailable" };
  }
  // No row updated: not yours, already deleted, or it changed state in another tab.
  if (!data || data.length === 0) {
    refresh();
    return { ok: false, error: "This link has changed or no longer exists. The list has been refreshed.", code: "not_found" };
  }
  if (options?.leaving !== true) refresh();
  return { ok: true, message: DONE[action] };
}

export async function updateLinkAction(id: string, input: LinkEditInput): Promise<ActionResult> {
  if (typeof id !== "string" || !UUID_PATTERN.test(id) || typeof input !== "object" || input === null) {
    return { ok: false, error: "That request wasn't valid.", code: "invalid" };
  }
  const checked = validateLinkEdit({
    destination: typeof input.destination === "string" ? input.destination : "",
    expiry: input.expiry,
    alias: typeof input.alias === "string" ? input.alias : undefined,
    currentSlug: typeof input.currentSlug === "string" ? input.currentSlug : undefined,
    utm: {
      source: typeof input.utm?.source === "string" ? input.utm.source : "",
      medium: typeof input.utm?.medium === "string" ? input.utm.medium : "",
      campaign: typeof input.utm?.campaign === "string" ? input.utm.campaign : "",
    },
  });
  if (!checked.ok) return { ok: false, error: "Check the highlighted fields.", code: "invalid", fieldErrors: checked.fieldErrors };

  const user = await getVerifiedUser();
  if (!user) return SIGNED_OUT;
  const wait = await manageWait(user.id);
  if (wait > 0) return slowDown(wait);
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: GENERIC, code: "unavailable" };

  // One UPDATE, so a new address and the other edits land together or not at
  // all. RLS limits it to the caller's own row; the database retires the old
  // address (see 20260925160000_link_management.sql).
  const { data, error } = await supabase
    .from("links")
    .update(checked.patch)
    .eq("id", id)
    .neq("status", "deleted")
    .select("id");

  if (error) {
    if (isLimitError(error)) return { ok: false, error: LIMIT_MESSAGE, code: "limit" };
    if (isSlugTaken(error)) {
      return { ok: false, error: "Check the highlighted fields.", code: "invalid", fieldErrors: { alias: "That address is already taken. Try a different one." } };
    }
    if (isSlugChangeLimit(error)) {
      return {
        ok: false,
        error: "Check the highlighted fields.",
        code: "invalid",
        fieldErrors: { alias: `This link has already changed address ${MAX_SLUG_CHANGES} times. Create a new link instead.` },
      };
    }
    if (isDeleted(error)) {
      refresh();
      return { ok: false, error: "This link was deleted. The list has been refreshed.", code: "not_found" };
    }
    logServerError("link_update_failed", error, { code: error.code });
    return { ok: false, error: GENERIC, code: "unavailable" };
  }
  if (!data || data.length === 0) {
    refresh();
    return { ok: false, error: "This link no longer exists. The list has been refreshed.", code: "not_found" };
  }
  refresh();
  const moved = checked.patch.slug;
  return { ok: true, message: moved ? "Link updated. Its address has changed." : "Link updated.", slug: moved };
}
